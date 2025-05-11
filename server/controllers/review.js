const prisma = require("../config/prisma");

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