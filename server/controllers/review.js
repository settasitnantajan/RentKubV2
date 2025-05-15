const prisma = require("../config/prisma");
const renderError = require("../utils/renderError"); // Assuming you have this utility

exports.createReview = async (req, res) => {
  const profileId = req.auth.userId;
  const {
    bookingId,
    landmarkId,
    overallRating,
    customerSupportRating,
    convenienceRating,
    signalQualityRating,
    text, // This is the comment
  } = req.body;

  if (!profileId) {
    return res.status(401).json({ message: "User not authenticated." });
  }

  if (!bookingId || !landmarkId || overallRating === undefined || overallRating === null) {
    return res.status(400).json({ message: "Missing required fields: bookingId, landmarkId, and overallRating are required." });
  }

  // Validate ratings
  const ratingsToValidate = { overallRating, customerSupportRating, convenienceRating, signalQualityRating };
  for (const key in ratingsToValidate) {
    const rating = ratingsToValidate[key];
    // overallRating must be 1-5. Others can be 0 (not rated) or 1-5.
    if (key === 'overallRating' && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
      return res.status(400).json({ message: `Overall rating must be between 1 and 5.` });
    }
    if (key !== 'overallRating' && rating !== undefined && rating !== null && (typeof rating !== 'number' || rating < 0 || rating > 5 || (rating !== 0 && rating < 1))) {
        return res.status(400).json({ message: `Rating for ${key} must be between 1 and 5, or 0 if not rated.` });
    }
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    if (booking.profileId !== profileId) {
      return res.status(403).json({ message: "You are not authorized to review this booking." });
    }

    if (booking.reviewed) {
      return res.status(400).json({ message: "This booking has already been reviewed." });
    }

    // Ensure the booking is fully completed for review eligibility
    if (!booking.paymentStatus || !booking.confirmStatus || !booking.checkInStatus || !booking.checkOutStatus) {
        return res.status(400).json({ message: "Booking must be fully completed (paid, confirmed, checked-in, and checked-out) to leave a review." });
    }

    const result = await prisma.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: {
          profileId,
          landmarkId: parseInt(landmarkId),
          overallRating: parseInt(overallRating),
          customerSupportRating: customerSupportRating ? parseInt(customerSupportRating) : 0,
          convenienceRating: convenienceRating ? parseInt(convenienceRating) : 0,
          signalQualityRating: signalQualityRating ? parseInt(signalQualityRating) : 0,
          text: text || null,
        },
      });

      await tx.booking.update({
        where: { id: parseInt(bookingId) },
        data: {
          reviewed: true,
          reviewId: newReview.id,
        },
      });

      return newReview;
    });

    res.status(201).json({ message: "Review submitted successfully.", review: result });
  } catch (error) {
    console.error("Error creating review:", error);
    // Handle potential unique constraint violation if, for some reason, reviewId on booking is not unique
    if (error.code === 'P2002' && error.meta?.target?.includes('reviewId')) {
        return res.status(409).json({ message: "Failed to link review to booking. Please try again." });
    }
    res.status(500).json({ message: "Internal server error while submitting review." });
  }
};

// Note: The addHostReplyToReview function still exists and uses a different logic (updating the Review model).
// You might want to refactor addHostReplyToReview to use createComment instead for consistency,
// potentially adding a flag or checking the profileId to identify it as a host reply if needed.

// --- New Function to Create Host Reply Comment ---
exports.createHostReplyComment = async (req, res, next) => {
  try {
    const hostClerkId = req.auth.userId; // Authenticated user (host)
    const { reviewId } = req.params; // Get reviewId from URL params
    const { text } = req.body; // Get reply text from body

    if (!hostClerkId) {
      return renderError(res, 401, "Host not authenticated.");
    }
    if (!text || typeof text !== 'string' || text.trim() === "") {
      return renderError(res, 400, "Reply text is required.");
    }
    if (isNaN(parseInt(reviewId))) {
      return renderError(res, 400, "Invalid review ID format.");
    }

    const reviewIdNum = parseInt(reviewId);

    // 1. Find the review and its associated landmark to verify host ownership and get landmarkId
    const review = await prisma.review.findUnique({
      where: { id: reviewIdNum },
      select: { // Select only necessary fields
        id: true,
        landmarkId: true,
        landmark: {
          select: {
            profileId: true, // This is the clerkId of the landmark owner (host)
          },
        },
      },
    });

    if (!review) {
      return renderError(res, 404, "Review not found.");
    }

    // 2. Authorization: Check if the authenticated user is the host of the landmark
    if (review.landmark.profileId !== hostClerkId) {
      return renderError(res, 403, "You are not authorized to reply to this review.");
    }

    // 3. Create the comment (host reply)
    const newComment = await prisma.comment.create({
      data: {
        text: text.trim(),
        profileId: hostClerkId,      // The host (authenticated user) making the reply
        reviewId: reviewIdNum,       // Link to the specific review
        landmarkId: review.landmarkId, // Link to the landmark the review is about
      },
      include: { // Include profile to return necessary data for frontend display
        profile: {
          select: { firstname: true, lastname: true, username: true, imageUrl: true, clerkId: true }
        }
      }
    });

    res.status(201).json({ message: "Host reply added successfully.", comment: newComment });
  } catch (error) {
    console.error("Error creating host reply comment:", error);
    next(error);
  }
};