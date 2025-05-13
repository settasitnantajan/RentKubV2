const prisma = require("../config/prisma");
const { calTotal } = require("../utils/booking");
const renderError = require("../utils/renderError");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { getUnavailableDatesForLandmark } = require('../utils/calendarUtils'); // Import new util

exports.listBookings = async (req, res, next) => {
  try {
    const { id } = req.user;

    const bookings = await prisma.booking.findMany({
      where: {
        profileId: id,
        // Removed: paymentStatus: true, to fetch all bookings for the user
      },
      include: {
        landmark: {
          select: {
            id: true,
            title: true,
            images: true, // Ensure images are included for the MyOrders page
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

exports.retryPayment = async (req, res, next) => {
  try {
    const { id: bookingIdFromBody } = req.body; // bookingId sent from frontend as 'id'
    const userId = req.user.id; // Assuming your authCheck middleware adds user to req (Clerk ID)

    if (!bookingIdFromBody) {
      return renderError(res, 400, "Booking ID is required.");
    }

    const bookingId = Number(bookingIdFromBody);
    if (isNaN(bookingId) || bookingId <= 0) {
      return renderError(res, 400, "Invalid Booking ID format.");
    }

    // 1. Fetch the booking from the database
    // Ensure the booking belongs to the authenticated user
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        profileId: userId, // Ensure booking belongs to the user
      },
      include: {
        landmark: {
          select: {
            id: true,
            title: true,
            images: true,
          },
        },
      },
    });

    if (!booking) {
      return renderError(res, 404, "Booking not found or access denied.");
    }

    // 2. Check if the booking is eligible for payment retry
    if (booking.paymentStatus) {
      return renderError(res, 400, "This booking has already been paid.");
    }
    if (booking.cancelledByUserStatus) {
      // Assuming you have cancelledByHostStatus as well, you might want to check it
      return renderError(
        res,
        400,
        "This booking has been cancelled and cannot be paid."
      );
    }
    // Add any other conditions that make a booking ineligible for retry

    // 3. Create a new Stripe Checkout session (redirect mode)
    const { total, landmark } = booking;
    const { title: landmarkTitle, images: landmarkImages } = landmark;
    const primaryImageUrl =
      landmarkImages && landmarkImages.length > 0 ? landmarkImages[0] : null;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "thb", // Or your booking's currency
            product_data: {
              name: `Retry Payment for: ${landmarkTitle}`,
              description: `Booking ID: ${booking.id}. Check-in: ${new Date(
                booking.checkIn
              ).toLocaleDateString()}, Check-out: ${new Date(
                booking.checkOut
              ).toLocaleDateString()}`,
              images: primaryImageUrl ? [primaryImageUrl] : [],
            },
            unit_amount: Math.round(total * 100), // Stripe expects amount in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/user/complete/{CHECKOUT_SESSION_ID}?retry=true&booking_id=${booking.id}`,
      cancel_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/user/myorders?payment_cancelled=true&booking_id=${booking.id}`,
      client_reference_id: booking.id.toString(),
      metadata: {
        bookingId: booking.id.toString(),
        userId: userId,
        isRetry: "true",
      },
    });

    // 4. Return the session URL to the client for redirection
    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Error retrying payment:", error);
    next(error); // Pass to global error handler
  }
};

exports.updateBookingStatusByHost = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { confirmStatus, checkInStatus, checkOutStatus } = req.body;
    const hostClerkId = req.user.id; // Assuming Clerk ID from authCheck middleware

    if (
      typeof confirmStatus === "undefined" &&
      typeof checkInStatus === "undefined" &&
      typeof checkOutStatus === "undefined"
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "No status field provided for update.",
        });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) },
      include: {
        landmark: {
          select: {
            profileId: true, // Host's Clerk ID (assuming profileId on landmark is the host's ID)
          },
        },
      },
    });

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found." });
    }

    // Authorization: Check if the authenticated user is the host of the landmark
    if (booking.landmark.profileId !== hostClerkId) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Unauthorized: You are not the host for this booking.",
        });
    }

    const dataToUpdate = {};
    if (typeof confirmStatus !== "undefined")
      dataToUpdate.confirmStatus = confirmStatus;
    if (typeof checkInStatus !== "undefined")
      dataToUpdate.checkInStatus = checkInStatus;
    if (typeof checkOutStatus !== "undefined")
      dataToUpdate.checkOutStatus = checkOutStatus;

    const updatedBooking = await prisma.booking.update({
      where: { id: Number(bookingId) },
      data: dataToUpdate,
    });

    res
      .status(200)
      .json({
        message: "Booking status updated successfully.",
        result: updatedBooking,
      });
  } catch (error) {
    console.error("Error updating booking status:", error);
    next(error);
  }
};

// --- New Function to Get Unavailable Dates ---
exports.getUnavailableDates = async (req, res, next) => {
  try {
    const { landmarkId } = req.params;
    const landmarkIdNum = Number(landmarkId);

    if (isNaN(landmarkIdNum) || landmarkIdNum <= 0) {
      return renderError(res, 400, "Invalid Landmark ID format.");
    }

    // 1. Get totalRooms for the landmark
    const landmark = await prisma.landmark.findUnique({
      where: { id: landmarkIdNum },
      select: { totalRooms: true },
    });

    if (!landmark) { // Corrected variable name from landmark to landmarkData
      return renderError(res, 404, "Landmark not found.");
    }

    // If landmark.totalRooms <= 0, it implies the landmark is not bookable.
    // The utility function will correctly return dates where booked count >= totalRooms.
    // The frontend can also use the totalRooms property to disable the calendar if it's <= 0.
    // For example, if totalRooms is 0, and there are any bookings (count > 0), those dates will be marked.
    // If totalRooms is 0 and no bookings, unavailableDates will be empty.
    // This behavior is consistent with how a calendar would typically show "no availability".

    const unavailableDates = await getUnavailableDatesForLandmark(landmarkIdNum, landmark.totalRooms);

    res.json({ result: unavailableDates });
  } catch (error) {
    console.error("Error fetching unavailable dates:", error);
    next(error);
  }
};
// --- End New Function ---

// --- New Function to Get Bookings by Camping ID ---
exports.getBookingsByCampingId = async (req, res, next) => {
  try {
    const { campingId } = req.params;
    const landmarkIdNum = Number(campingId);

    if (isNaN(landmarkIdNum) || landmarkIdNum <= 0) {
      return renderError(res, 400, "Invalid Camping ID format.");
    }

    // Find bookings associated with the landmark ID
    const bookings = await prisma.booking.findMany({
      where: {
        landmarkId: landmarkIdNum,
        // Optionally filter by paymentStatus or other criteria if needed
        paymentStatus: true, // <-- UNCOMMENT OR ADD THIS LINE
        confirmStatus: false,
      },
      include: {
        // Include related data you might need
        profile: {
          select: { id: true, firstname: true, lastname: true, email: true },
        },
        landmark: { select: { id: true, title: true } },
      },
      orderBy: {
        createdAt: "desc", // Or checkIn, etc.
      },
    });

    res.json({ result: bookings });
  } catch (error) {
    console.error("Error fetching bookings by camping ID:", error);
    next(error);
  }
};
// --- End New Function ---

exports.createBooking = async (req, res, next) => {
  try {
    // Destructing req.body
    const { campingId, checkIn, checkOut } = req.body;
    const { id } = req.user;
    // // Delete Booking
    // await prisma.booking.deleteMany({
    //   where: {
    //     profileId: id,
    //     paymentStatus: false,
    //   },
    // });

    // --- Availability Check ---
    // 1. Find Camping and its totalRooms
    const camping = await prisma.landmark.findFirst({
      where: {
        id: campingId,
      },
      select: {
        price: true,
        totalRooms: true, // <-- Select totalRooms
        title: true, // <-- Select title for error message
      },
    });

    if (!camping) {
      // Use renderError utility
      return renderError(res, 404, "Camping spot not found.");
    }

    // 2. Count overlapping confirmed bookings
    const overlappingBookingsCount = await prisma.booking.count({
      where: {
        landmarkId: campingId,
        paymentStatus: true, // Only count confirmed bookings
        // Overlap condition:
        // An existing booking overlaps if its start date is before the new checkout date
        // AND its end date is after the new check-in date.
        checkIn: {
          lt: checkOut, // Existing checkIn < requested checkOut
        },
        checkOut: {
          gt: checkIn, // Existing checkOut > requested checkIn
        },
      },
    });

    // 3. Compare with totalRooms
    if (overlappingBookingsCount >= camping.totalRooms) {
      return renderError(
        res,
        409,
        `Sorry, '${camping.title}' is fully booked for the selected dates.`
      ); // 409 Conflict
    }
    // --- End Availability Check ---

    // Calculate total price (if available)
    // --- Add Logging before calTotal ---
    console.log(
      `[createBooking] Calculating total for checkIn: ${checkIn} (Type: ${typeof checkIn}), checkOut: ${checkOut} (Type: ${typeof checkOut}), price: ${
        camping.price
      }`
    );
    // --- End Logging ---
    const { total, totalNights } = calTotal(checkIn, checkOut, camping.price);
    // --- Add Logging before create ---
    console.log(`[createBooking] Attempting to create booking with data:`, {
      profileId: id,
      landmarkId: campingId,
      checkIn, // Ensure this is a valid Date or ISO string Prisma understands
      checkOut, // Ensure this is a valid Date or ISO string Prisma understands
      total,
      totalNights,
    });
    // --- End Logging ---

    // Insert to db
    const booking = await prisma.booking.create({
      data: {
        profileId: id,
        landmarkId: campingId,
        checkIn,
        checkOut,
        total,
        totalNights,
      },
    });
    console.log("[createBooking] Booking created successfully:", booking); // Log success
    const bookingId = booking.id;

    // Send id booking to react
    res.json({ message: "Booking Successfully", result: bookingId });
  } catch (error) {
    // --- Enhanced Error Logging ---
    console.error("[createBooking] Error caught:", error);
    next(error);
  }
};

exports.checkout = async (req, res, next) => {
  try {
    const { id } = req.body; // ID comes from the request body
    console.log("Checkout attempt for booking ID:", id, typeof id); // <-- Add logging

    // Ensure ID is a valid number before querying
    const bookingId = Number(id);
    if (isNaN(bookingId) || bookingId <= 0) {
      console.error("Invalid booking ID received:", id);
      // Use return res.status().json() for consistency
      return res.status(400).json({ message: "Invalid Booking ID format." });
      // Or use your renderError if it handles sending responses:
      // return renderError(res, 400, "Invalid Booking ID format.");
    }

    console.log("Searching for booking with numeric ID:", bookingId); // <-- Add logging

    //1.find booking
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId, // Use the validated numeric ID
      },
      include: {
        landmark: {
          select: {
            id: true,
            images: true, // Corrected based on previous error
            title: true,
          },
        },
      },
    });

    // Log if booking was found or not
    console.log("Booking found:", booking ? booking.id : "Not Found");

    if (!booking) {
      console.error(`Booking with ID ${bookingId} not found in database.`);
      // Use 404 Not Found, as the ID format might be okay, but the resource doesn't exist
      return res.status(404).json({ message: "Booking not found" });
      // Or use your renderError if it handles sending responses:
      // return renderError(res, 404, "Booking not found"); // Pass res if needed by renderError
    }

    // --- Code continues if booking IS found ---

    // Destructure images instead of images
    const { total, landmark } = booking; // Removed unused vars like totalNights, checkIn, checkOut
    const { title, images } = landmark; // Corrected destructuring

    // Get the first image URL for Stripe, handle cases where images might be empty
    const primaryImageUrl = images && images.length > 0 ? images[0] : null;

    // 2.stripe
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      metadata: { bookingId: booking.id },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "thb",
            product_data: {
              name: title,
              images: primaryImageUrl ? [primaryImageUrl] : [], // Use the first image
              description: "Thank you for booking with us",
            },
            unit_amount: Math.round(total * 100), // Ensure integer cents
          },
        },
      ],
      mode: "payment",
      // Use environment variable for flexibility
      return_url: `${
        process.env.CLIENT_URL || "http://localhost:5173"
      }/user/complete/{CHECKOUT_SESSION_ID}`,
    });

    res.send({ clientSecret: session.client_secret });
  } catch (error) {
    console.error("Error during checkout process:", error); // Log the full error
    // Pass the error to the global error handler
    next(error);
  }
};

exports.checkOutStatus = async (req, res, next) => {
  try {
    const { session_id } = req.params;
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const bookingId = session.metadata?.bookingId;
    console.log(bookingId);

    // Check
    if (session.status !== "complete" || !bookingId) {
      return renderError(400, "Something went wrong");
    }

    // Update db paymentStatus => true
    const result = await prisma.booking.update({
      where: {
        id: Number(bookingId),
      },
      data: {
        paymentStatus: true,
      },
    });

    res.json({ message: "Payment Successfully", status: session.status });
  } catch (error) {
    next(error);
  }
};

exports.deleteBookingByUser = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id; // Assuming Clerk ID from authCheck middleware

    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) },
    });

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found." });
    }

    // Authorization: Check if the authenticated user is the owner of the booking
    if (booking.profileId !== userId) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Unauthorized: You are not the owner of this booking.",
        });
    }

    // Optional: Add logic here if there are conditions under which a booking cannot be deleted
    // (e.g., if it's too close to the check-in date, or if payment has been processed and refunds are complex)

    await prisma.booking.delete({
      where: { id: Number(bookingId) },
    });

    res.status(200).json({ message: "Booking deleted successfully." });
  } catch (error) {
    console.error("Error deleting booking:", error);
    next(error);
  }
};

exports.cancelBookingByUser = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id; // Assuming Clerk ID from authCheck middleware

    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) },
    });

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found." });
    }

    // Authorization: Check if the authenticated user is the owner of the booking
    if (booking.profileId !== userId) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Unauthorized: You are not the owner of this booking.",
        });
    }

    console.log(
      `[cancelBookingByUser] Processing booking ID ${bookingId}. Current status:`,
      JSON.stringify(booking, null, 2)
    );

    // Conditions under which a user CANNOT cancel:
    if (booking.cancelledByUserStatus) {
      console.log(
        `[cancelBookingByUser] Booking ${bookingId} is already cancelled by user.`
      );
      return res
        .status(400)
        .json({ success: false, message: "Booking is already cancelled." });
    }
    if (booking.checkInStatus || booking.checkOutStatus) {
      console.log(
        `[cancelBookingByUser] Booking ${bookingId} is checked in or out.`
      );
      return res
        .status(400)
        .json({
          success: false,
          message: "Booking cannot be cancelled after check-in or check-out.",
        });
    }
    // If booking is paid AND confirmed by the host, user cannot cancel through this flow.
    if (booking.paymentStatus && booking.confirmStatus) {
      console.log(
        `[cancelBookingByUser] Booking ${bookingId} is paid AND confirmed by host. Cannot cancel.`
      );
      return res
        .status(400)
        .json({
          success: false,
          message:
            "This booking is confirmed and cannot be cancelled by you. Please contact the host.",
        });
    }

    // If none of the above conditions are met, proceed to cancel
    const updatedBooking = await prisma.booking.update({
      where: { id: Number(bookingId) },
      data: {
        cancelledByUserStatus: true,
      },
    });

    res
      .status(200)
      .json({
        message: "Booking cancelled successfully.",
        result: updatedBooking,
      });
  } catch (error) {
    console.error("Error cancelling booking by user:", error);
    next(error);
  }
};
