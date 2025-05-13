// /Users/duke/Documents/GitHub/RentKub/server/controllers/profile.js
const renderError = require("../utils/renderError");
const prisma = require("../config/prisma");
const { clerkClient } = require("@clerk/clerk-sdk-node"); // Import clerkClient

// Create Profile (using upsert - can also handle initial creation)
exports.createProfile = async (req, res, next) => {
  try {
    const { firstname: bodyFirstname, lastname: bodyLastname, username: bodyUsername } = req.body; // Names and username from request body
    const clerkId = req.auth.userId; // From authCheck middleware

    if (!clerkId) {
      return renderError(res, 401, "User not authenticated properly.");
    }

    // Fetch user details from Clerk to get email and imageUrl
    const clerkUser = await clerkClient.users.getUser(clerkId);
    if (!clerkUser) {
      return renderError(res, 404, "Clerk user not found.");
    }

    const email = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;
    // Note: Clerk's `username` is separate from `firstName`/`lastName`
    const clerkUsername = clerkUser.username; // Get username from Clerk
    const imageUrl = clerkUser.imageUrl;

    // Use data from request body if provided, otherwise fallback to Clerk's data
    const finalFirstname = bodyFirstname || clerkUser.firstName;
    const finalLastname = bodyLastname || clerkUser.lastName;    const finalUsername = bodyUsername || clerkUsername; // Prioritize body username, then Clerk username
    const profile = await prisma.profile.upsert({
      where: { clerkId: clerkId },
      update: { firstname: finalFirstname, lastname: finalLastname, username: finalUsername, email, imageUrl }, // Include username in update
      create: { firstname: finalFirstname, lastname: finalLastname, username: finalUsername, clerkId: clerkId, email, imageUrl }, // Include username in create
    });
    res.status(200).json(profile);
  } catch (error) {
    console.error("Error in create/update profile:", error);
    if (error.isClerkAPIResponseError) { // Check if it's a Clerk specific error object
        let message = "Clerk API error: ";
        (error.errors || []).forEach(err => message += `${err.longMessage || err.message} `);
        return renderError(res, error.status || 500, message.trim() || "Unknown Clerk error");
    }
    next(error);
  }
};

// Get Profile
exports.getProfile = async (req, res, next) => {
  try {
    const clerkId = req.auth.userId; // From authCheck middleware

    if (!clerkId) {
      return renderError(res, 401, "Authentication details missing.");
    }

    const profile = await prisma.profile.findUnique({
      where: { clerkId: clerkId },
    });

    if (!profile) {
      return res.status(404).json({ message: "Profile not found for this user. Please create a profile." });
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error.message);
    next(error);
  }
};

// --- New Function to Update Profile ---
exports.updateProfile = async (req, res, next) => {
  try {
    const clerkId = req.auth.userId; // Get clerkId from authenticated user
    const { firstname, lastname, username } = req.body; // Get data to update from request body

    if (!clerkId) {
      return renderError(res, 401, "User not authenticated properly.");
    }
    
    // Validate input (basic example)
    if (!firstname && !lastname) { // Allow updating one or both
      return renderError(res, 400, "At least one field (firstname or lastname) is required for update.");
    }

    const dataToUpdate = {};
    if (firstname) dataToUpdate.firstname = firstname;
    if (lastname) dataToUpdate.lastname = lastname;
    if (typeof username !== 'undefined') dataToUpdate.username = username === '' ? null : username; // Handle optional username, save empty string as null

    // Note: This endpoint primarily updates names.
    // imageUrl and email are synced via the `createProfile` (upsert) endpoint.

    // Find the profile and update it
    const updatedProfile = await prisma.profile.update({
      where: {
        clerkId: clerkId, // Find the profile by clerkId
      },
      data: dataToUpdate,
    });

    // If update is successful, return the updated profile data
    res.status(200).json(updatedProfile);

  } catch (error) {
    // Handle potential errors, e.g., profile not found for the user during update
    if (error.code === 'P2025') { // Prisma error code for record not found
        return renderError(res, 404, "Profile not found to update.");
    }
    console.error("Error updating profile:", error.message);
    next(error); // Pass other errors to global error handler
  }
};
// --- End New Function ---
