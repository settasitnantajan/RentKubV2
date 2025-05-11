const prisma = require("../config/prisma");
const cloudinary = require("cloudinary").v2; // <-- Import Cloudinary v2
const renderError = require("../utils/renderError"); // <-- Import renderError

const getPublicIdFromUrl = (url) => {
  try {
    // Example URL: https://res.cloudinary.com/<cloud_name>/<resource_type>/upload/<version>/<folder>/<public_id>.<format>
    // We want to extract '<folder>/<public_id>' or just '<public_id>'
    // Regex breakdown:
    // \/upload\/ : Matches '/upload/'
    // (?:v\d+\/)? : Optionally matches a version folder like 'v12345/' (non-capturing group)
    // (.+?) : Captures the public ID and any folders (non-greedy) - THIS IS GROUP 1
    // (?:\.[^.]+)?: Optionally matches the file extension (like '.jpg') (non-capturing group)
    // $ : End of the string
    const regex = /\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/;
    const match = url.match(regex);
    // If match is found, return the captured group 1, otherwise null
    return match ? match[1] : null;
  } catch (e) {
    console.error(`Error parsing Cloudinary URL "${url}":`, e);
    return null; // Return null if parsing fails
  }
};

exports.listStats = async (req, res, next) => {
  try {
    const usersCount = await prisma.profile.count();
    const campingsCount = await prisma.landmark.count();
    const bookingsCount = await prisma.booking.count({
      where: {
        paymentStatus: true,
      },
    });
    res.json({
      usersCount: usersCount,
      campingsCount: campingsCount,
      bookingsCount: bookingsCount,
    });
  } catch (error) {
    next(error);
  }
};

exports.listUsers = async (req, res, next) => {
  // Make sure 'exports.' is there
  try {
    const users = await prisma.profile.findMany({
      select: {
        id: true,
        createAt: true,
        updateAt: true,
        email: true,
        firstname: true,
        lastname: true,
        clerkId: true,
      },
      orderBy: {
        createAt: "desc",
      },
    });
    res.json({ result: users });
  } catch (error) {
    next(error);
  }
};

exports.listCampings = async (req, res, next) => {
  // Make sure 'exports.' is there
  try {
    const users = await prisma.landmark.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        createAt: true, // Corrected from createAt
        images: true,
        profileId: true,
        category: true, // <-- Added category field
        profile: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
          },
        },
      },
      orderBy: {
        createAt: "desc", // Corrected from createAt
      },
    });
    res.json({ result: users });
  } catch (error) {
    next(error);
  }
};

exports.deleteCamping = async (req, res, next) => {
  try {
    const { id } = req.params;
    const campingId = Number(id);

    if (isNaN(campingId) || campingId <= 0) {
      return renderError(res, 400, "Invalid Camping ID format."); // Use imported renderError
    }

    // 1. Find the landmark to get its image URLs and title
    const landmarkToDelete = await prisma.landmark.findUnique({
      where: { id: campingId },
      select: {
        images: true, // Select the array of image URLs
        title: true, // Select title for the success message
      },
    });

    if (!landmarkToDelete) {
      return renderError(res, 404, "Camping not found."); // Use imported renderError
    }

    // --- Handle related records ---
    // Delete related favorites
    const deletedFavorites = await prisma.favorite.deleteMany({
      where: { landmarkId: campingId },
    });
    console.log(`Deleted ${deletedFavorites.count} favorite records.`);

    // Delete related bookings (Consider business logic for paid/active bookings if needed)
    const deletedBookings = await prisma.booking.deleteMany({
      where: { landmarkId: campingId },
    });
    console.log(`Deleted ${deletedBookings.count} booking records.`);
    // --- End handling related records ---

    // 2. Delete the landmark record from the database
    await prisma.landmark.delete({
      where: {
        id: campingId,
      },
    });
    console.log(`Deleted landmark record with ID: ${campingId}`);

    // 3. If the landmark had images, delete them from Cloudinary
    if (landmarkToDelete.images && landmarkToDelete.images.length > 0) {
      // Use the helper function to get public IDs
      const publicIds = landmarkToDelete.images
        .map(getPublicIdFromUrl) // <--- Use the defined helper function
        .filter(Boolean); // Filter out any nulls if extraction failed

      if (publicIds.length > 0) {
        console.log(
          `Attempting to delete ${
            publicIds.length
          } Cloudinary images with public IDs: ${publicIds.join(", ")}`
        );

        // Use Promise.allSettled to attempt all deletions even if some fail
        const deletionResults = await Promise.allSettled(
          publicIds.map((publicId) =>
            cloudinary.uploader.destroy(publicId, (error, result) => {
              // Optional: Callback for logging individual results immediately
              if (error) {
                console.error(
                  `Cloudinary deletion error for ${publicId}:`,
                  error
                );
              } else {
                console.log(
                  `Cloudinary deletion result for ${publicId}:`,
                  result
                );
              }
            })
          )
        );

        // Log settled results (useful for seeing which ones failed after all promises complete)
        deletionResults.forEach((result, index) => {
          if (result.status === "fulfilled") {
            // Result from cloudinary.uploader.destroy is often { result: 'ok' } or { result: 'not found' }
            console.log(
              `Cloudinary deletion attempt for ${publicIds[index]} completed:`,
              result.value
            );
          } else {
            // Log errors but don't fail the whole request
            console.error(
              `Failed Cloudinary deletion promise for ${publicIds[index]}:`,
              result.reason?.message || result.reason
            );
          }
        });
      } else {
        console.log("No valid public IDs found to delete from Cloudinary.");
      }
    } else {
      console.log("Landmark had no images associated in the database.");
    }

    res.json({
      message: `Camping '${landmarkToDelete.title}' (ID: ${campingId}) and associated data deleted successfully.`,
    });
  } catch (error) {
    if (error.code === "P2025") {
      // Prisma: Record to delete does not exist
      return renderError(res, 404, "Camping not found to delete."); // Use imported renderError
    }
    console.error("Error deleting camping:", error);
    next(error); // Pass to the global error handler
  }
};

exports.listBookings = async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        total: true,
        totalNights: true,
        paymentStatus: true,
        createdAt: true,
        profile: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
          },
        },
        landmark: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        checkIn: "asc",
      },
    });

    res.json({ result: bookings, message: "List Bookings" });
  } catch (error) {
    next(error);
  }
};
