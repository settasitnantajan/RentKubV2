// /Users/duke/Documents/GitHub/RentKub/server/utils/calendarUtils.js
const prisma = require("../config/prisma");

/**
 * Calculates unavailable dates for a given landmark.
 * @param {number} landmarkId - The ID of the landmark.
 * @param {number} totalRooms - The total number of rooms/units for the landmark.
 * @returns {Promise<string[]>} - A promise that resolves to an array of unavailable date strings (YYYY-MM-DD).
 */
async function getUnavailableDatesForLandmark(landmarkId, totalRooms) {
    // If totalRooms is 0 or less, the landmark is not bookable.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Normalize to start of UTC day

    const maxFutureDate = new Date(today);
    maxFutureDate.setUTCMonth(maxFutureDate.getUTCMonth() + 6); // Consider bookings up to 6 months in the future

    // If totalRooms is 0 or less, the landmark is not bookable.
    // All dates within the considered range should be marked unavailable.
    if (totalRooms <= 0) {
        const allDatesInRange = [];
        let currentDate = new Date(today);
        while (currentDate <= maxFutureDate) {
            allDatesInRange.push(currentDate.toISOString().split("T")[0]);
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        return allDatesInRange.sort();
    }

    // Fetch confirmed bookings that are relevant (ongoing or future)
    const bookings = await prisma.booking.findMany({
        where: {
            landmarkId: landmarkId,
            paymentStatus: true,
            confirmStatus: false, // <-- ADD THIS LINE
            checkOut: { gt: today }, // Booking ends after today starts
        },
        select: { checkIn: true, checkOut: true },
    });

    const bookedCounts = {}; // Stores { 'YYYY-MM-DD': count }

    bookings.forEach(booking => {
        let currentDate = new Date(booking.checkIn);
        currentDate.setUTCHours(0, 0, 0, 0); // Normalize booking check-in date

        const bookingEndDate = new Date(booking.checkOut);
        bookingEndDate.setUTCHours(0, 0, 0, 0); // Normalize booking check-out date

        // Iterate through each day of this specific booking's duration
        while (currentDate < bookingEndDate) {
            // If the current date of the booking is already past our observation window (maxFutureDate),
            // there's no need to check further days for THIS booking.
            if (currentDate > maxFutureDate) {
                break;
            }

            // Only count the date if it's from today onwards (and implicitly <= maxFutureDate due to the break above)
            if (currentDate >= today) {
                const dateString = currentDate.toISOString().split("T")[0];
                bookedCounts[dateString] = (bookedCounts[dateString] || 0) + 1;
            }

            currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Move to the next UTC day
        }
    });

    // Filter dates where the number of bookings meets or exceeds totalRooms
    const unavailableDates = Object.keys(bookedCounts).filter(dateString => bookedCounts[dateString] >= totalRooms);
    return unavailableDates.sort(); // Return sorted array of unavailable dates
}

module.exports = { getUnavailableDatesForLandmark };