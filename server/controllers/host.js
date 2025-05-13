const prisma = require("../config/prisma");
const renderError = require("../utils/renderError");

// Get all landmarks owned by the currently authenticated host
exports.getHostLandmarks = async (req, res, next) => {
  try {
    const { id: profileId } = req.user; // Get the host's profile ID from authenticated user

    if (!profileId) {
      return renderError(res, 401, "Authentication failed or user ID missing.");
    }

    const landmarks = await prisma.landmark.findMany({
      where: {
        profileId: profileId,
      },
      orderBy: {
        createAt: "desc", // Show newest first
      },
      // Include reviews and select the overallRating for the dashboard chart
      include: {
        reviews: {
          select: {
            overallRating: true, // This is the key field for the rating chart
            // You can include other review fields if needed for other dashboard features
            // id: true,
            // text: true,
          }
        },
        _count: {
          select: {
            reviews: true,   // Keep existing review count
            favorites: true  // Add favorite count
          }
        }
      }
    });
    res.status(200).json(landmarks);
  } catch (error) {
    console.error("Error fetching host landmarks:", error);
    next(error);
  }
};

// Get all bookings for landmarks owned by the currently authenticated host
exports.getHostBookings = async (req, res, next) => {
  try {
    const { id: hostProfileId } = req.user; // Get the host's profile ID

    if (!hostProfileId) {
      return renderError(res, 401, "Authentication failed or user ID missing.");
    }

    const bookings = await prisma.booking.findMany({
      where: {
        landmark: {
          // Filter based on the related landmark's owner
          profileId: hostProfileId,
        },
      },
      include: {
        // Include landmark details for display on the dashboard
        landmark: { select: { title: true, id: true } },
        // Include guest profile details
        profile: {
          select: { firstname: true, lastname: true, email: true, id: true },
        }, // Added id for potential future use
      },
      orderBy: {
        createdAt: "desc", // Show most recent bookings first
      },
    });

    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching host bookings:", error);
    next(error);
  }
};
