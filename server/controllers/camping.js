const prisma = require("../config/prisma");
const { findCenter } = require("../utils/findCenter");
const renderError = require("../utils/renderError");
const { getUnavailableDatesForLandmark } = require('../utils/calendarUtils'); // Import new util
const cloudinary = require("cloudinary").v2; // Import Cloudinary
// const { getPublicIdFromUrl } = require("../utils/cloudinaryHelper"); // Remove this line

// --- Add the helper function directly here ---
const getPublicIdFromUrl = (url) => {
  try {
    // Regex: Matches '/upload/', optional version, captures public_id (with folders), optional extension
    const regex = /\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/;
    const match = url.match(regex);
    return match ? match[1] : null;
  } catch (e) {
    console.error(`Error parsing Cloudinary URL "${url}":`, e);
    return null;
  }
};
// --- End helper function ---

exports.listCamping = async (req, res, next) => {
  try {
    const { id: profileIdForFavorites } = req.params; // This 'id' is profileId for favorites check
    const { addressSearch } = req.query; // Get addressSearch from query parameters

    const whereClause = {};
    if (addressSearch && typeof addressSearch === 'string' && addressSearch.trim() !== '') {
      whereClause.address = {
        contains: addressSearch.trim(),
        // mode: 'insensitive', // Optional: Use for case-insensitive search if your DB supports it (e.g., PostgreSQL)
      };
    }

    const landmarks = await prisma.landmark.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined, // Apply where clause if it has conditions
      include: {
        // Conditionally include favorites based on profileIdForFavorites
        ...(profileIdForFavorites && { // Only include if profileIdForFavorites is truthy
          favorites: {
            where: {
              profileId: profileIdForFavorites,
            },
            select: {
              id: true,
            },
          },
        }),
        // Include reviews to calculate average and count
        reviews: {
          select: {
            overallRating: true,
          },
        },
        // Include host (profile) information
        profile: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            username: true,
            email: true, // Optional: include if needed on the listing card
            imageUrl: true, // Optional: include if needed
          },
        },
      },
    });

    const landmarksWithDetails = landmarks.map((landmark) => {
      const reviewCount = landmark.reviews?.length || 0; // Calculate count from the fetched reviews array
      let averageRating = 0;

      if (reviewCount > 0) {
        const sumOfRatings = landmark.reviews.reduce(
          (acc, review) => acc + review.overallRating,
          0
        );
        averageRating = sumOfRatings / reviewCount;
      }

      return {
        ...landmark,
        isFavorite: profileIdForFavorites ? (landmark.favorites?.length || 0) > 0 : false,
        averageRating: parseFloat(averageRating.toFixed(1)), // Format to one decimal place
        reviewCount: reviewCount,
        // Clean up: remove raw reviews and favorites from the final mapped object sent to client
        // profile: landmark.profile, // This is already included by spreading landmark
        reviews: undefined, // We've used them, now remove
        favorites: undefined, // We've used them, now remove
      };
    });

    // Find Center
    const center = findCenter(landmarksWithDetails);

    res.json({ result: landmarksWithDetails, center: center });
  } catch (error) {
    console.error("Error in listCamping:", error);
    next(error);
  }
};

exports.readCamping = async (req, res, next) => {
  try {
    const landmarkId = Number(req.params.id); // Use a distinct variable name
    if (isNaN(landmarkId)) {
      return renderError(res, 400, "Invalid Landmark ID format.");
    }

    const clerkId = req.auth?.userId; // Get Clerk User ID from req.auth (populated by Clerk middleware if token is valid)
    
    const landmark = await prisma.landmark.findFirst({
      where: {
        id: landmarkId, // Use the numeric landmarkId
      },
      include: {
        reviews: { // Include reviews
          orderBy: {
            createdAt: 'desc', // Show newest reviews first
          },
          include: {
            profile: { // Include the profile of the reviewer
              select: {
                firstname: true, // Ensure these field names match your Profile model
                lastname: true,
                username: true,
                email: true,
                imageUrl: true,
                clerkId: true, // Useful for keys or other identification
              },
            },
            // Include comments associated with the review (this is where host replies will be)
            comments: {
              include: {
                profile: { // Include the profile of the commenter (could be the host)
                  select: { firstname: true, lastname: true, username: true, imageUrl: true, clerkId: true }
                }
              },
            },
          },
        },
        // Assuming you also want to show host details
        profile: true, // Or select specific fields for the host's profile
      },
    });

    if (!landmark) {
      return renderError(res, 404, "Landmark not found.");
    }

    // --- Get publicly unavailable dates ---
    // This should be done regardless of whether a user is logged in or not
    const publiclyUnavailableDates = await getUnavailableDatesForLandmark(landmarkId, landmark.totalRooms);

    // Calculate averageRating and reviewCount
    const reviewCount = landmark.reviews?.length || 0;
    let averageRating = 0;
    if (reviewCount > 0) {
      const sumOfRatings = landmark.reviews.reduce(
        (acc, review) => acc + (review.overallRating || 0),
        0
      );
      averageRating = sumOfRatings / reviewCount;
    }

    let isFavoriteForCurrentUser = false;
    if (clerkId) { // If a user is logged in (clerkId exists)
      const favoriteRecord = await prisma.favorite.findFirst({
        where: {
          profileId: clerkId, // Use the string Clerk ID for the Favorite query
          landmarkId: landmarkId,
        },
        select: { id: true } // We only need to know if the record exists
      });
      if (favoriteRecord) {
        isFavoriteForCurrentUser = true;
      }
    }

    const landmarkWithDetails = {
      ...landmark,
      isFavorite: isFavoriteForCurrentUser, // Set the user-specific favorite status
      averageRating: parseFloat(averageRating.toFixed(1)),
      reviewCount: reviewCount,
      publiclyUnavailableDates: publiclyUnavailableDates, // Add this to the response
    };

    res.json({ result: landmarkWithDetails });
  } catch (error) {
    console.error("Error in readCamping:", error);
    next(error);
  }
};

exports.createCamping = async (req, res, next) => {
  try {
    console.log("Received request body:", req.body);

    const {
      title,
      description,
      price,
      category,
      lat,
      lng,
      images,
      amenities,
      totalRooms,
      maxGuests, // <-- Destructure maxGuests
      bedrooms,  // <-- Destructure bedrooms
      beds,      // <-- Destructure beds
      baths, // <-- Destructure baths
    } = req.body;
    const { id: profileId } = req.user;
    console.log("Received images:", images); // Log the received images array

    // --- Backend Validation ---
    if (!profileId) {
      return renderError(res, 401, "User authentication failed.");
    }
    if (
      !title ||
      !description ||
      price == null ||
      !category ||
      lat == null ||
      lng == null ||
      totalRooms == null || // <-- Check totalRooms
      maxGuests == null ||  // <-- Check maxGuests
      bedrooms == null || // <-- Check bedrooms
      beds == null ||     // <-- Check beds
      baths == null // <-- Check baths
    ) {
      // Check price != null
      return renderError(
        res,
        400,
        "Missing required fields (title, description, price, category, location, address, totalRooms, maxGuests, bedrooms, beds, baths)."
      );
    } // Removed address check
    if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      return renderError(res, 400, "Price must be a positive number.");
    }
    // <-- Add validation for totalRooms -->
    if (isNaN(parseInt(totalRooms, 10)) || parseInt(totalRooms, 10) <= 0) {
      return renderError(res, 400, "Total Rooms/Sites must be a positive integer.");
    }
    // <-- Add validation for maxGuests -->
    if (isNaN(parseInt(maxGuests, 10)) || parseInt(maxGuests, 10) <= 0) {
      return renderError(res, 400, "Max Guests must be a positive integer.");
    }
    // <-- Add validation for bedrooms -->
    if (isNaN(parseInt(bedrooms, 10)) || parseInt(bedrooms, 10) < 0) {
      return renderError(res, 400, "Bedrooms must be a non-negative integer.");
    }
    // <-- Add validation for beds -->
    if (isNaN(parseInt(beds, 10)) || parseInt(beds, 10) <= 0) {
      return renderError(res, 400, "Beds must be a positive integer.");
    }
    if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
      return renderError(res, 400, "Invalid latitude or longitude format.");
    }
    // Validate images array
    if (!Array.isArray(images) || images.length < 1 || images.length > 8) {
      return renderError(
        res,
        400,
        "Please provide between 1 and 8 image URLs."
      );
    }
    // **IMPORTANT**: Validate that images are STRINGS (URLs) now
    if (
      !images.every(
        (img) =>
          typeof img === "string" &&
          img.trim().length > 0 &&
          img.startsWith("http")
      )
    ) {
      console.error(
        "Validation failed: Images array does not contain valid URLs:",
        images
      ); // Add detailed log
      return renderError(
        res,
        400,
        "Invalid image URL format found in the list. Expected strings starting with http."
      );
    }
    // Validate amenities
    if (!Array.isArray(amenities)) {
      // Allow empty amenities array if optional, otherwise enforce minimum
      // Assuming amenities are optional based on schema: .optional().default([])
      // If required, add: || amenities.length < 1
      return renderError(res, 400, "Amenities must be provided as an array.");
    }
    // --- End Validation ---

    const amenitiesJsonString = JSON.stringify(amenities);
    console.log("Amenities JSON string:", amenitiesJsonString);

    const dataToSave = {
      title,
      description,
      price: parseFloat(price),
      category,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      images: images, // Should be an array of strings now
      profileId: profileId,
      totalRooms: parseInt(totalRooms, 10), // <-- Add parsed totalRooms
      maxGuests: parseInt(maxGuests, 10),   // <-- Add parsed maxGuests
      bedrooms: parseInt(bedrooms, 10),     // <-- Add parsed bedrooms
      beds: parseInt(beds, 10),             // <-- Add parsed beds
      baths: parseInt(baths, 10),           // <-- Add parsed baths
      amenities: amenitiesJsonString,
    };

    console.log("Data being sent to Prisma:", dataToSave);

    const camping = await prisma.landmark.create({
      data: dataToSave,
    });

    console.log("Prisma create successful:", camping);
    // Parse amenities before sending back response for consistency
    const resultWithParsedAmenities = {
      ...camping,
      amenities: JSON.parse(camping.amenities), // Parse back from string
    };
    res.status(201).json({
      message: "Created Camping Successfully",
      result: resultWithParsedAmenities,
    });
  } catch (error) {
    console.error("Error in createCamping:", error);
    if (error.code === "P2002") {
      // Extract target field if available
      const field = error.meta?.target?.[0] || "details";
      return renderError(
        res,
        409,
        `A camping spot with similar ${field} might already exist.`
      );
    }
    // Handle potential JSON parsing errors during response creation if needed
    next(error);
  }
};

exports.updateCamping = async (req, res, next) => {
  try {
    const { id: landmarkId } = req.params;
    const { id: profileId } = req.user;
    const {
      title,
      description,
      price,
      category,
      lat,
      lng,
      images,
      amenities,
      totalRooms,
      maxGuests, // <-- Destructure maxGuests
      bedrooms,  // <-- Destructure bedrooms
      beds,      // <-- Destructure beds
      baths, // <-- Destructure baths
    } = req.body;

    // --- TEMPORARY DEBUG LOGGING ---
    console.log("--- Update Camping ---");
    console.log("Received amenities TYPE:", typeof amenities);
    console.log("Received amenities VALUE:", amenities);
    const landmarkIdNum = Number(landmarkId);

    // --- Validation ---
    if (isNaN(landmarkIdNum) || landmarkIdNum <= 0) {
      return renderError(res, 400, "Invalid Landmark ID format.");
    }
    if (!profileId) {
      return renderError(res, 401, "User authentication failed.");
    }
    // Basic validation for required fields (similar to create)
    if (
      !title ||
      !description ||
      price == null ||
      !category ||
      lat == null ||
      lng == null ||
      totalRooms == null || // <-- Check totalRooms
      maxGuests == null ||  // <-- Check maxGuests
      bedrooms == null || // <-- Check bedrooms
      beds == null ||     // <-- Check beds
      baths == null // <-- Check baths
    ) {
      return renderError(
        res,
        400,
        "Missing required fields (title, description, price, category, location, address, totalRooms, maxGuests, bedrooms, beds, baths)."
      );
    } // Removed address check
    if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      return renderError(res, 400, "Price must be a positive number.");
    }
    // <-- Add validation for totalRooms -->
    if (isNaN(parseInt(totalRooms, 10)) || parseInt(totalRooms, 10) <= 0) {
      return renderError(res, 400, "Total Rooms/Sites must be a positive integer.");
    }
    // <-- Add validation for maxGuests -->
    if (isNaN(parseInt(maxGuests, 10)) || parseInt(maxGuests, 10) <= 0) {
      return renderError(res, 400, "Max Guests must be a positive integer.");
    }
    // <-- Add validation for bedrooms -->
    if (isNaN(parseInt(bedrooms, 10)) || parseInt(bedrooms, 10) < 0) {
      return renderError(res, 400, "Bedrooms must be a non-negative integer.");
    }
    // <-- Add validation for beds -->
    if (isNaN(parseInt(beds, 10)) || parseInt(beds, 10) <= 0) {
      return renderError(res, 400, "Beds must be a positive integer.");
    }
    if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
      return renderError(res, 400, "Invalid latitude or longitude format.");
    }
    if (!Array.isArray(images) || images.length < 1 || images.length > 8) {
      return renderError(
        res,
        400,
        "Please provide between 1 and 8 image URLs."
      );
    }
    if (
      !images.every(
        (img) =>
          typeof img === "string" &&
          img.trim().length > 0 &&
          img.startsWith("http")
      )
    ) {
      return renderError(
        res,
        400,
        "Invalid image URL format found. Expected strings starting with http."
      );
    }
    if (!Array.isArray(amenities)) {
      return renderError(res, 400, "Amenities must be provided as an array.");
    }
    // --- End Validation ---

    // Check if landmark exists and belongs to the user
    const existingLandmark = await prisma.landmark.findUnique({
      where: { id: landmarkIdNum },
      select: { images: true, profileId: true }, // Select images and profileId
    });

    if (!existingLandmark) {
      return renderError(res, 404, "Landmark not found.");
    }

    if (existingLandmark.profileId !== profileId) {
      return renderError(
        res,
        403,
        "Forbidden: You do not have permission to update this landmark."
      );
    }

    // --- Image Deletion Logic ---
    const oldImageUrls = existingLandmark.images || [];
    const newImageUrls = images || []; // Images from the request body

    // Find URLs to delete (present in old, not in new)
    const urlsToDelete = oldImageUrls.filter(
      (oldUrl) => !newImageUrls.includes(oldUrl)
    );

    if (urlsToDelete.length > 0) {
      const publicIdsToDelete = urlsToDelete
        .map(getPublicIdFromUrl) // Use the helper
        .filter(Boolean); // Filter out nulls if parsing failed

      if (publicIdsToDelete.length > 0) {
        console.log(
          `Attempting to delete ${publicIdsToDelete.length} old Cloudinary images...`
        );
        // Use Promise.allSettled for robustness
        const deletionResults = await Promise.allSettled(
          publicIdsToDelete.map((publicId) =>
            cloudinary.uploader.destroy(publicId)
          )
        );
        deletionResults.forEach((result, index) => {
          if (result.status === "fulfilled") {
            console.log(
              `Cloudinary deletion for ${publicIdsToDelete[index]} completed:`,
              result.value
            );
          } else {
            console.error(
              `Failed Cloudinary deletion for ${publicIdsToDelete[index]}:`,
              result.reason?.message || result.reason
            );
            // Decide if you want to stop the update process if deletion fails, or just log it. Currently, it just logs.
          }
        });
      }
    }
    // --- End Image Deletion Logic ---

    // Prepare data for update
    const amenitiesJsonString = JSON.stringify(amenities);
    const dataToUpdate = {
      title,
      description,
      price: parseFloat(price),
      category,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      images: images, // Assuming the client sends the full updated array of image URLs
      amenities: amenitiesJsonString,
      totalRooms: parseInt(totalRooms, 10), // <-- Add parsed totalRooms
      maxGuests: parseInt(maxGuests, 10),   // <-- Add parsed maxGuests
      bedrooms: parseInt(bedrooms, 10),     // <-- Add parsed bedrooms
      beds: parseInt(beds, 10),             // <-- Add parsed beds
      baths: parseInt(baths, 10),           // <-- Add parsed baths
      // profileId is not updated
    };

    // Perform the update
    const updatedLandmark = await prisma.landmark.update({
      where: { id: landmarkIdNum },
      data: dataToUpdate,
    });

    // Parse amenities before sending response
    const resultWithParsedAmenities = {
      ...updatedLandmark,
      amenities: JSON.parse(updatedLandmark.amenities),
    };

    res.status(200).json({
      message: "Landmark updated successfully",
      result: resultWithParsedAmenities,
    });
  } catch (error) {
    console.error("Error updating landmark:", error);
    if (error.code === "P2025") {
      // Record to update not found (should be caught earlier, but good fallback)
      return renderError(res, 404, "Landmark not found to update.");
    }
    next(error);
  }
};

exports.deleteCamping = async (req, res, next) => {
  try {
    const { id: landmarkId } = req.params;
    const { id: profileId } = req.user;
    const landmarkIdNum = Number(landmarkId);

    if (isNaN(landmarkIdNum) || landmarkIdNum <= 0) {
      return renderError(res, 400, "Invalid Landmark ID format.");
    }
    if (!profileId) {
      return renderError(res, 401, "User authentication failed.");
    }

    // 1. Find the landmark to check ownership and get image URLs
    const landmarkToDelete = await prisma.landmark.findUnique({
      where: { id: landmarkIdNum },
      select: { images: true, title: true, profileId: true },
    });

    if (!landmarkToDelete) {
      return renderError(res, 404, "Landmark not found.");
    }

    // 2. Verify ownership
    if (landmarkToDelete.profileId !== profileId) {
      return renderError(
        res,
        403,
        "Forbidden: You do not have permission to delete this landmark."
      );
    }

    // 3. Delete related records (Favorites, Bookings)
    // Note: Consider business logic for active/paid bookings if needed.
    // This simple delete might not be suitable if you need to prevent deletion of booked landmarks.
    await prisma.favorite.deleteMany({ where: { landmarkId: landmarkIdNum } });
    await prisma.booking.deleteMany({ where: { landmarkId: landmarkIdNum } });
    console.log(
      `Deleted related favorites and bookings for landmark ID: ${landmarkIdNum}`
    );

    // 4. Delete the landmark record
    await prisma.landmark.delete({
      where: { id: landmarkIdNum },
    });
    console.log(`Deleted landmark record with ID: ${landmarkIdNum}`);

    // 5. Delete images from Cloudinary
    if (landmarkToDelete.images && landmarkToDelete.images.length > 0) {
      const publicIds = landmarkToDelete.images
        .map(getPublicIdFromUrl) // Use the helper
        .filter(Boolean);

      if (publicIds.length > 0) {
        console.log(
          `Attempting to delete ${publicIds.length} Cloudinary images...`
        );
        // Use Promise.allSettled for robustness
        const deletionResults = await Promise.allSettled(
          publicIds.map((publicId) => cloudinary.uploader.destroy(publicId))
        );
        deletionResults.forEach((result, index) => {
          if (result.status === "fulfilled") {
            console.log(
              `Cloudinary deletion for ${publicIds[index]} completed:`,
              result.value
            );
          } else {
            console.error(
              `Failed Cloudinary deletion for ${publicIds[index]}:`,
              result.reason?.message || result.reason
            );
          }
        });
      }
    }

    res.status(200).json({
      message: `Landmark '${landmarkToDelete.title}' (ID: ${landmarkIdNum}) and associated data deleted successfully.`,
    });
  } catch (error) {
    console.error("Error deleting landmark:", error);
    if (error.code === "P2025") {
      // Record to delete not found
      return renderError(res, 404, "Landmark not found to delete.");
    }
    next(error);
  }
};

// Favorites
exports.actionFavorite = async (req, res, next) => {
  try {
    const { campingId, isFavorite } = req.body;
    const { id } = req.user;

    // Add or Remove
    let result;
    if (isFavorite) {
      result = await prisma.favorite.deleteMany({
        where: {
          profileId: id,
          landmarkId: campingId,
        },
      });
    } else {
      result = await prisma.favorite.create({
        data: {
          profileId: id,
          landmarkId: campingId,
        },
      });
    }

    res.json({
      message: isFavorite ? "Remove Favorite" : "Add Favorite",
      result,
    });
  } catch (error) {
    next(error);
  }
};

exports.listFavorites = async (req, res, next) => {
  try {
    const { id } = req.user;
    const favoriteRecords = await prisma.favorite.findMany({
      where: {
        profileId: id,
      },
      include: {
        landmark: { // Include the full landmark
          include: { // Nested include for reviews of the landmark
            reviews: {
              select: {
                overallRating: true,
              },
            },
          },
        },
      },
    });

    const favoritesWithDetails = favoriteRecords.map((fav) => {
      if (!fav.landmark) {
        return { ...fav, landmark: null };
      }

      const reviewCount = fav.landmark.reviews?.length || 0;
      let averageRating = 0;
      if (reviewCount > 0) {
        const sumOfRatings = fav.landmark.reviews.reduce(
          (acc, review) => acc + review.overallRating,
          0
        );
        averageRating = sumOfRatings / reviewCount;
      }

      const landmarkDetails = {
        ...fav.landmark,
        reviews: undefined, // Clean up raw reviews
        averageRating: parseFloat(averageRating.toFixed(1)),
        reviewCount: reviewCount,
        isFavorite: true,
      };

      return {
        ...fav,
        landmark: landmarkDetails,
      };
    });

    res.json({ message: "success", result: favoritesWithDetails });
  } catch (error) {
    console.error("Error in listFavorites:", error);
    next(error);
  }
};

exports.filterCamping = async (req, res, next) => {
  try {
    const {
      category,
      search,
      priceMin,
      priceMax,
      amenities, // Expects comma-separated string: "wifi,kitchen,pool"
      checkIn: checkInQuery,
      checkOut: checkOutQuery,
    } = req.query;

    // The /filter-camping route does not have authCheck, so req.user is undefined.
    // To get `isFavorite` status, client would need to pass profileId or route needs auth.
    // For now, `isFavorite` will not be accurately determined here.
    const userId = req.query.profileId || req.user?.id; // Prioritize profileId from query if passed
    const prismaClient = prisma; // Alias for clarity in helper function

    console.log("Filtering with query:", req.query);

    // Prepare filter conditions for Prisma
    const whereClause = {
      AND: [], // Use AND to combine all conditions
    };

    // --- Date Parsing and Validation ---
    let reqCheckInDate = null;
    let reqCheckOutDate = null;
    let filterByDate = false;

    if (checkInQuery && checkOutQuery) {
      reqCheckInDate = new Date(checkInQuery); // Assumes YYYY-MM-DD or ISO string
      reqCheckOutDate = new Date(checkOutQuery); // Assumes YYYY-MM-DD or ISO string

      if (isNaN(reqCheckInDate.getTime()) || isNaN(reqCheckOutDate.getTime())) {
        console.warn("Invalid date format received for date filter, ignoring.");
        filterByDate = false;
      } else if (reqCheckInDate >= reqCheckOutDate) {
        console.warn("Check-out date must be after check-in date, ignoring date filter.");
        filterByDate = false;
      } else {
        // Normalize dates to the start of the day (UTC) for consistent comparisons
        reqCheckInDate.setUTCHours(0, 0, 0, 0);
        reqCheckOutDate.setUTCHours(0, 0, 0, 0);
        filterByDate = true;
        console.log(`Filtering for dates: ${reqCheckInDate.toISOString()} to ${reqCheckOutDate.toISOString()}`);
      }
    }

    // 1. Category Filter
    if (category && typeof category === "string" && category.trim() !== "") {
      // Avoid adding filter if category is something like '[]' or invalid
      if (!category.startsWith("[")) {
        whereClause.AND.push({ category: category.trim() });
      } else {
        console.warn(
          `Received potentially invalid category filter value: ${category}`
        );
      }
    }

    // 2. Search Filter (Now Case-sensitive due to removal of 'mode')
    const searchTerm = typeof search === "string" ? search.trim() : "";
    // Avoid adding filter if search is 'undefined' or empty
    if (searchTerm.length > 0 && searchTerm.toLowerCase() !== "undefined") {
      whereClause.AND.push({
        OR: [
          { title: { contains: searchTerm } }, // Removed mode: "insensitive"
          { description: { contains: searchTerm } }, // Removed mode: "insensitive"
        ],
      });
    } else if (searchTerm.toLowerCase() === "undefined") {
      console.warn(
        'Received "undefined" as search term, ignoring search filter.'
      );
    }

    // 3. Price Range Filter
    const minPriceNum = parseFloat(priceMin);
    const maxPriceNum = parseFloat(priceMax);

    if (!isNaN(minPriceNum) && minPriceNum >= 0) {
      whereClause.AND.push({ price: { gte: minPriceNum } });
    }
    if (!isNaN(maxPriceNum) && maxPriceNum > 0) {
      // Ensure maxPrice is only added if it's valid and >= minPrice (if minPrice exists)
      if (!isNaN(minPriceNum) && minPriceNum >= 0) {
        if (maxPriceNum >= minPriceNum) {
          whereClause.AND.push({ price: { lte: maxPriceNum } });
        } else {
          console.warn(
            `Max price (${maxPriceNum}) is less than Min price (${minPriceNum}). Ignoring Max price filter.`
          );
        }
      } else {
        // Add maxPrice if minPrice is not set or invalid
        whereClause.AND.push({ price: { lte: maxPriceNum } });
      }
    }

    // 4. Amenities Filter (Using 'contains' on the JSON string column)
    let amenitiesArray = [];
    if (amenities && typeof amenities === "string") {
      amenitiesArray = amenities
        .split(",")
        .map((a) => a.trim().toLowerCase()) // Normalize to lowercase
        .filter((a) => a !== "");
    }

    // --- NOTE: Amenities filter removed from Prisma query due to 'contains' validation error on Json type.
    // --- We will filter amenities after fetching the results. ---

    // Log the clause *before* fetching (it won't include amenities filter now)
    console.log(
      "Constructed Prisma where clause:",
      JSON.stringify(whereClause, null, 2)
    );

    // --- Fetch Landmarks ---
    const result = await prisma.landmark.findMany({
      where: whereClause.AND.length > 0 ? whereClause : undefined, // Apply where only if filters exist
      include: {
        ...(userId && { // Conditionally include favorites if userId is available
          // This ensures `favorites` relation is loaded if userId is present
          favorites: {
            where: { profileId: userId },
            select: { id: true },
          }
        }),
        // Include reviews for calculating averageRating and reviewCount
        reviews: {
          select: {
            overallRating: true,
          }
        }
        // totalRooms is a scalar field, selected by default if no `select` is used.
      },
    });

    // --- Helper function to check landmark availability for a given date range ---
    function isLandmarkEffectivelyAvailable(landmark, reqCheckIn, reqCheckOut, landmarkSpecificBookings) {
      if (!landmark.totalRooms || landmark.totalRooms <= 0) {
        return false; // No rooms or invalid room count
      }

      let currentDate = new Date(reqCheckIn); // Create a copy to iterate
      const endDate = new Date(reqCheckOut);

      while (currentDate < endDate) {
        let bookingsOnThisDay = 0;
        for (const booking of landmarkSpecificBookings) {
          const bookingCheckIn = new Date(booking.checkIn);
          const bookingCheckOut = new Date(booking.checkOut);
          // Check if the current iteration date falls within this booking's range
          if (currentDate >= bookingCheckIn && currentDate < bookingCheckOut) {
            bookingsOnThisDay++;
          }
        }

        if (bookingsOnThisDay >= landmark.totalRooms) {
          return false; // Fully booked on this day
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Move to the next day (UTC)
      }
      return true; // Available for the entire range
    }

    // --- Date Filtering Step ---
    let landmarksToProcess = result;

    if (filterByDate && landmarksToProcess.length > 0) {
      const landmarkIds = landmarksToProcess.map(lm => lm.id);

      const allPotentiallyRelevantBookings = await prismaClient.booking.findMany({
        where: {
          landmarkId: { in: landmarkIds },
          paymentStatus: true,
          checkIn: { lt: reqCheckOutDate }, // Booking starts before requested checkout
          checkOut: { gt: reqCheckInDate }, // Booking ends after requested checkin
        },
        select: { landmarkId: true, checkIn: true, checkOut: true },
      });

      const bookingsByLandmarkId = allPotentiallyRelevantBookings.reduce((acc, booking) => {
        (acc[booking.landmarkId] = acc[booking.landmarkId] || []).push(booking);
        return acc;
      }, {});

      landmarksToProcess = landmarksToProcess.filter(landmark =>
        isLandmarkEffectivelyAvailable(landmark, reqCheckInDate, reqCheckOutDate, bookingsByLandmarkId[landmark.id] || [])
      );
    }

    // --- Filter results based on amenities in application code ---
    let filteredByAmenitiesResults = landmarksToProcess; // Start with date-filtered (or all if no date filter)
    if (amenitiesArray.length > 0) {
      console.log("Filtering fetched results for amenities:", amenitiesArray);
      filteredByAmenitiesResults = landmarksToProcess.filter((item) => {
        let itemAmenities = [];
        try {
          // Safely parse the amenities JSON string
          if (
            item.amenities &&
            typeof item.amenities === "string" &&
            item.amenities.trim().startsWith("[")
          ) {
            itemAmenities = JSON.parse(item.amenities).map((a) =>
              typeof a === "string" ? a.toLowerCase() : a
            ); // Parse and normalize to lowercase
          } else if (Array.isArray(item.amenities)) {
            itemAmenities = item.amenities.map((a) =>
              typeof a === "string" ? a.toLowerCase() : a
            ); // Normalize existing array
          }
        } catch (e) {
          console.error(
            `Failed to parse amenities for filtering landmark ID ${item.id}. Raw: "${item.amenities}". Error:`,
            e.message
          );
          return false; // Exclude if amenities can't be parsed
        }
        // Check if *all* requested amenities are present in the item's amenities (case-insensitive)
        return amenitiesArray.every((requestedAmenity) =>
          itemAmenities.includes(requestedAmenity)
        );
      });
    }

    // --- Process Results (Parse amenities, add favorite status) ---
    const campingWithLike = filteredByAmenitiesResults.map((item) => {
      // Calculate averageRating and reviewCount
      const reviewCount = item.reviews?.length || 0;
      let averageRating = 0;
      if (reviewCount > 0) {
        const sumOfRatings = item.reviews.reduce(
          (acc, review) => acc + review.overallRating,
          0
        );
        averageRating = sumOfRatings / reviewCount;
      }

      // Map over the *filtered* results
      let parsedAmenities = [];
      try {
        // Safely parse the amenities JSON string
        if (
          item.amenities &&
          typeof item.amenities === "string" &&
          item.amenities.trim().startsWith("[")
        ) {
          parsedAmenities = JSON.parse(item.amenities);
          if (!Array.isArray(parsedAmenities)) {
            console.warn(
              `Parsed amenities for landmark ID ${item.id} is not an array:`,
              parsedAmenities
            );
            parsedAmenities = [];
          }
        } else if (Array.isArray(item.amenities)) {
          parsedAmenities = item.amenities; // Handle cases where it might already be an array
        }
      } catch (e) {
        console.error(
          `Failed to parse amenities JSON for landmark ID ${item.id}. Raw: "${item.amenities}". Error:`,
          e.message
        );
      }
      return {
        ...item,
        isFavorite: userId ? (item.favorites?.length || 0) > 0 : false,
        amenities: parsedAmenities, // Return the parsed array
        averageRating: parseFloat(averageRating.toFixed(1)),
        reviewCount: reviewCount,
        favorites: undefined, // Remove the favorites relation data from the final response if not needed
        reviews: undefined, // Clean up raw reviews
      };
    });

    // --- Calculate Center ---
    const center =
      campingWithLike.length > 0 ? findCenter(campingWithLike) : null;

    res.json({ result: campingWithLike, center: center });
  } catch (error) {
    // --- Error Handling ---
    if (error.name === "PrismaClientValidationError") {
      console.error("Prisma Validation Error in filterCamping:", error.message);
      // Use renderError utility if available and it handles sending the response
      // return renderError(res, 400, `Filter query failed due to invalid parameters. ${error.message}`);
      // Otherwise, send a standard response:
      return res.status(400).json({
        message: `Filter query failed due to invalid parameters. ${error.message}`,
      });
    }
    console.error("Error in filterCamping:", error);
    if (error.code && error.code.startsWith("P20")) {
      // return renderError(res, 400, `Filter query failed. Check parameters. Prisma code: ${error.code}`);
      return res.status(400).json({
        message: `Filter query failed. Check parameters. Prisma code: ${error.code}`,
      });
    }
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
      console.error(
        "JSON Parsing Error likely during response mapping:",
        error
      );
      // return renderError(res, 500, "Error processing data after fetching. Check amenities format in DB.");
      return res.status(500).json({
        message:
          "Error processing data after fetching. Check amenities format in DB.",
      });
    }
    next(error); // Pass to the global error handler for other errors
  }
};

// --- New Function to Get Booked Dates for Single-Unit Landmarks ---
exports.getBookedDates = async (req, res, next) => {
  try {
    const { id: landmarkId } = req.params;
    const landmarkIdNum = Number(landmarkId);

    if (isNaN(landmarkIdNum) || landmarkIdNum <= 0) {
      return renderError(res, 400, "Invalid Landmark ID format.");
    }

    const landmark = await prisma.landmark.findUnique({
      where: { id: landmarkIdNum },
      select: { totalRooms: true }, // Only need totalRooms initially
    });

    if (!landmark) {
      return renderError(res, 404, "Landmark not found.");
    }

    // Only proceed if totalRooms is 0 (or maybe 1, depending on your exact logic for unique items)
    // Let's assume 0 or 1 means unique/single unit for this example. Adjust if needed.
    if (landmark.totalRooms > 1) {
      // If more than one room, availability is handled differently (by count), return empty
      return res.json({ bookedRanges: [] });
    }

    // Fetch confirmed bookings for this landmark
    const bookings = await prisma.booking.findMany({
      where: { landmarkId: landmarkIdNum, paymentStatus: true },
      select: { checkIn: true, checkOut: true },
    });

    res.json({ bookedRanges: bookings }); // Send the checkIn/checkOut pairs
  } catch (error) {
    console.error("Error fetching booked dates:", error);
    next(error);
  }
};
// --- End New Function ---
