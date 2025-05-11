import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { getHostBookings, getHostLandmarks } from "@/api/host.jsx"; // Import the new API functions
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"; // Import specific recharts components used by shadcn charts
import {
  Card,
  CardContent,
  CardDescription, // Added for chart context
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow, // Removed Badge import
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"; // Corrected import path
// import { format } from "date-fns"; // For formatting dates (install if needed: npm install date-fns)
import {
  formatDateISO,
  formatDateShort,
  formatDatePretty,
  formatCurrency,
  formatNumber,
} from "@/utils/formats.jsx"; // Import custom formatters
import { updateBookingStatus } from "@/api/booking";
import { Link } from "react-router"; // <-- Import Link
import { Input } from "@/components/ui/input"; 
import { Search, Star } from "lucide-react"; // <-- Import Search and Star icons

const HostDashboard = () => {
  const { getToken } = useAuth();
  const [landmarks, setLandmarks] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]); // State for pending requests
  const [loading, setLoading] = useState(true);
  const [incomeData, setIncomeData] = useState([]); // State for income chart
  const [searchTermLandmarks, setSearchTermLandmarks] = useState("");
  const [searchTermAllBookings, setSearchTermAllBookings] = useState("");
  const [searchTermConfirmedBookings, setSearchTermConfirmedBookings] =
    useState("");

  // Define chart config for income
  const incomeChartConfig = {
    income: {
      label: "Income",
      color: "hsl(var(--chart-1))", // Use shadcn CSS variables
    },
    // Add more series if needed
  };

  const [bookingTrendData, setBookingTrendData] = useState([]); // State for booking trend chart
  // Define chart config for booking trends
  const bookingTrendChartConfig = {
    count: {
      label: "Bookings",
      color: "hsl(var(--chart-3))", // Use a different shadcn CSS variable
    },
  };

  const [reviewData, setReviewData] = useState([]); // State for review chart
  // Define chart config for reviews
  const reviewChartConfig = {
    count: {
      label: "Count",
      color: "hsl(var(--chart-2))", // Use different shadcn CSS variable
    },
    // Define colors for each star rating if needed for more complex charts
    // stars: {
    //   label: "Stars",
    //   color: "hsl(var(--chart-3))",
    // }
  };
  const [error, setError] = useState(null);

  // Define fetchData in the component scope so it can be called by useEffect and handlers
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        // Handle case where user is not authenticated or token is unavailable
        throw new Error("Authentication token not available.");
      }

      // Fetch landmarks and bookings in parallel
      const [landmarksRes, bookingsRes] = await Promise.all([
        getHostLandmarks(token),
        getHostBookings(token),
      ]);

      const allLandmarks = landmarksRes.data || []; // Get all landmarks for the host
      const allBookings = bookingsRes.data || [];
      const pending = allBookings.filter((booking) => !booking.paymentStatus);
      // You could also filter for confirmed bookings if needed:
      // const confirmed = allBookings.filter(booking => booking.paymentStatus);

      setLandmarks(landmarksRes.data || []);
      setBookings(allBookings); // Keep all bookings for the "Recent Bookings" section for now
      setPendingBookings(pending); // Set the filtered pending bookings

      // --- Process data for charts ---

      // 1. Income Chart (Last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const confirmedBookingsLast30Days = allBookings.filter(
        (b) => b.paymentStatus && new Date(b.createdAt) >= thirtyDaysAgo // Assuming createdAt is the booking date
      );
      console.log(
        "Confirmed Bookings (Last 30 Days):",
        confirmedBookingsLast30Days
      );

      const dailyIncome = confirmedBookingsLast30Days.reduce((acc, booking) => {
        const date = formatDateISO(booking.createdAt); // Use custom formatter
        acc[date] = (acc[date] || 0) + booking.total;
        return acc;
      }, {});

      // Create data points for the last 30 days, including days with 0 income
      const incomeChartData = [];
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const formattedDate = formatDateISO(date); // Use custom formatter
        const shortDate = formatDateShort(date); // Use custom formatter
        incomeChartData.push({
          date: shortDate, // Use short date for display
          fullDate: formattedDate, // Keep full date for sorting/reference
          income: dailyIncome[formattedDate] || 0,
        });
      }
      console.log("Income Chart Data:", incomeChartData);
      setIncomeData(incomeChartData.reverse()); // Reverse to show oldest date first

      // 2. Booking Trend Chart (Last 30 days)
      const bookingsLast30Days = allBookings.filter(
        (b) => new Date(b.createdAt) >= thirtyDaysAgo
      );

      const dailyBookings = bookingsLast30Days.reduce((acc, booking) => {
        const date = formatDateISO(booking.createdAt); // Use custom formatter
        acc[date] = (acc[date] || 0) + 1; // Increment count for the day
        return acc;
      }, {});

      const bookingChartData = [];
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const formattedDate = formatDateISO(date); // Use custom formatter
        const shortDate = formatDateShort(date); // Use custom formatter
        bookingChartData.push({
          date: shortDate,
          count: dailyBookings[formattedDate] || 0,
        });
      }
      setBookingTrendData(bookingChartData.reverse()); // Reverse to show oldest date first

      // 3. Review Stars Distribution
      const starCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; // Initialize counts for 1 to 5 stars

      if (allLandmarks && allLandmarks.length > 0) {
        allLandmarks.forEach(landmark => {
          // Assuming each landmark object has a 'reviews' array
          // and each review object has an 'overallRating' field (number 1-5)
          if (landmark.reviews && landmark.reviews.length > 0) {
            landmark.reviews.forEach(review => {
              const rating = Math.round(review.overallRating); // Ensure integer rating
              if (rating >= 1 && rating <= 5) { // Check if rating is within valid range
                starCounts[rating]++;
              }
            });
          }
        });
      }

      const processedReviewData = Object.keys(starCounts)
        .map(star => ({
          stars: parseInt(star), // The star rating value (e.g., 1, 2, 3, 4, 5)
          count: starCounts[star], // The number of reviews with this star rating
        })).sort((a, b) => b.stars - a.stars); // Ensure sorted by stars in descending order for the chart display

      setReviewData(processedReviewData);
    } catch (err) {
      console.error("Error fetching host data:", err);
      setError(
        err.response?.data?.message || // Check for backend error message
          err.message ||
          "Failed to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [getToken]); // Re-run effect if getToken function instance changes

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        Loading dashboard...
      </div>
    );
  }

  // console.log("Landmarks:", landmarks); // Corrected/clarified console log
  // console.log("All Bookings (state):", bookings);
  // console.log("Pending Bookings (state):", pendingBookings); // For debugging if needed
  // console.log("Income Data:", incomeData);
  // console.log("Booking Trend Data:", bookingTrendData);
  // console.log("Review Data:", reviewData);

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-6 lg:p-8 text-red-600">
        Error: {error}
      </div>
    );
  }

  // --- Action Handlers ---
  // Generic function to update booking status.
  // You'll need to create corresponding API endpoints and client-side API functions.
  // For example, in your api/host.jsx or api/booking.jsx:
  // export const updateBookingStatus = async (token, bookingId, statusUpdate) => {
  //   return apiClient.patch(`/bookings/${bookingId}/status`, statusUpdate, {
  //     headers: { Authorization: `Bearer ${token}` },
  //   });
  // };

  const handleUpdateBookingStatus = async (
    bookingId,
    statusField,
    successMessage
  ) => {
    try {
      const token = await getToken();
      await updateBookingStatus(token, bookingId, { [statusField]: true }); // Actual API call
      alert(`${successMessage} for booking ID: ${bookingId}.`); // Consider using a toast notification
      fetchData(); // Refetch all data to reflect changes
    } catch (error) {
      console.error(
        `Error updating ${statusField} for booking ${bookingId}:`,
        error
      );
      alert(`Failed to update ${statusField}. Please try again.`); // Consider using a toast notification
    }
  };

  const handleConfirmBooking = (bookingId) => {
    handleUpdateBookingStatus(bookingId, "confirmStatus", "Booking confirmed");
  };

  const handleCheckIn = (bookingId) => {
    handleUpdateBookingStatus(bookingId, "checkInStatus", "Guest checked-in");
  };

  const handleCheckOut = (bookingId) => {
    handleUpdateBookingStatus(bookingId, "checkOutStatus", "Guest checked-out");
  };

  // Function to determine button properties based on booking status
  const getActionButtonProps = (booking) => {
    // Destructure all relevant statuses from the booking object
    // Ensure 'cancelledByUserStatus' is provided by your getHostBookings API
    const {
      paymentStatus = false,
      confirmStatus = false,
      checkInStatus = false,
      checkOutStatus = false,
      cancelledByUserStatus = false,
    } = booking;

    if (cancelledByUserStatus) {
      return {
        text: "Cancelled by User", // Clearly indicate user cancellation
        onClick: () => {},
        disabled: true,
        className: "text-gray-500 border-gray-300 bg-gray-100 cursor-not-allowed", // Changed to gray
      };
    }

    // If not cancelled by user, proceed with other status checks
    if (!paymentStatus) {
      return {
        text: "Awaiting Payment", // Host sees this, cannot act
        onClick: () => {},
        disabled: true,
        className: "text-orange-600 border-orange-300 bg-orange-50", // Style for waiting payment
      };
    }
    // From here, paymentStatus is true
    if (!confirmStatus) {
      return {
        text: "Confirm Booking",
        onClick: () => handleConfirmBooking(booking.id),
        disabled: false,
        className: "hover:bg-blue-50 text-blue-600 border-blue-300",
      };
    }
    // From here, paymentStatus and confirmStatus are true
    if (!checkInStatus) {
      return {
        text: "Mark as Checked-In",
        onClick: () => handleCheckIn(booking.id),
        disabled: false,
        className: "hover:bg-indigo-50 text-indigo-600 border-indigo-300",
      };
    }
    // From here, paymentStatus, confirmStatus, and checkInStatus are true
    if (!checkOutStatus) {
      return {
        text: "Mark as Checked-Out",
        onClick: () => handleCheckOut(booking.id),
        disabled: false,
        className: "hover:bg-purple-50 text-purple-600 border-purple-300",
      };
    }
    // All primary actions completed by host (paid, confirmed, checked-in, checked-out)
    return {
      text: "Booking Completed", // Final state from host's active involvement
      onClick: () => {},
      disabled: true,
      className: "text-gray-500 border-gray-300 bg-gray-100 cursor-not-allowed", // Changed to gray
    };
  };

  // --- Calculate overall totals ---
  const totalOverallIncome = bookings
    .filter((booking) => booking.paymentStatus) // Only count income from paid bookings
    .reduce((sum, booking) => sum + (booking.total || 0), 0);

  const totalOverallBookings = bookings.length;

  // --- Filtered Data for Search ---
  const filteredLandmarks = landmarks.filter((landmark) =>
    landmark.title.toLowerCase().includes(searchTermLandmarks.toLowerCase())
  );

  const filterBookings = (bookingsToFilter, term) => {
    if (!term.trim()) return bookingsToFilter;
    const lowerCaseTerm = term.toLowerCase();
    return bookingsToFilter.filter((booking) => {
      const bookingId = (booking.id || "").toString().toLowerCase();
      const propertyTitle = (booking.landmark?.title || "").toLowerCase();
      const guestFirstName = (booking.profile?.firstname || "").toLowerCase();
      const guestLastName = (booking.profile?.lastname || "").toLowerCase();
      const guestFullName = `${guestFirstName} ${guestLastName}`.trim();

      return (
        bookingId.includes(lowerCaseTerm) ||
        propertyTitle.includes(lowerCaseTerm) ||
        guestFirstName.includes(lowerCaseTerm) ||
        guestLastName.includes(lowerCaseTerm) ||
        guestFullName.includes(lowerCaseTerm)
      );
    });
  };

  const filteredAllBookings = filterBookings(bookings, searchTermAllBookings);
  const filteredConfirmedBookings = filterBookings(
    bookings.filter((b) => b.paymentStatus),
    searchTermConfirmedBookings
  );

  const renderNoResultsMessage = (colSpan, term) => (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="h-24 text-center text-muted-foreground"
      >
        No results found matching your search "{term}".
      </TableCell>
    </TableRow>
  );

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Host Dashboard</h1>

      {/* Overall Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(totalOverallIncome)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Total Bookings Received</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatNumber(totalOverallBookings)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grid for main sections */}

      {/* Grid for Properties and Booking Requests */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {" "}
        {/* Added md:grid-cols-2 */}
        <Card className="md:col-span-2 lg:col-span-1">
          {" "}
          {/* Adjusted spans: Full width on md, 1/3 on lg */}
          <CardHeader>
            <CardTitle>Review Stars</CardTitle>
            <CardDescription>Distribution of review ratings.</CardDescription>
          </CardHeader>
          <CardContent>
            {reviewData.length > 0 ? (
              <ChartContainer
                config={reviewChartConfig}
                className="min-h-[200px] w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={reviewData}
                  layout="vertical"
                  margin={{ left: 10, right: 10 }}
                >
                  <CartesianGrid horizontal={false} />
                  <YAxis
                    dataKey="stars"
                    type="category" // Treat stars as categories on Y-axis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => `${value} ★`} // Add star icon
                  />
                  <XAxis type="number" hide /> {/* Hide X-axis line/ticks */}
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar
                    dataKey="count"
                    layout="vertical"
                    fill={reviewChartConfig.count.color}
                    radius={4}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                No review data available.
              </p>
            )}
          </CardContent>
        </Card>
        {/* My Properties Section (Takes full width on small, 1/3 on large) */}
        <Card className="md:col-span-1 lg:col-span-2">
          {" "}
          {/* Adjusted spans */}
          {/* --- Modified CardHeader to include Manage Campings button --- */}
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            {" "}
            <CardTitle>
              My Properties {landmarks.length > 0 ? `(${landmarks.length})` : ''}
            </CardTitle>
            <Link to="/admin/camping">
              {" "}
              {/* Link to the admin camping page */}
              <Button variant="outline" size="sm">
                Create Landmark
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {landmarks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                You haven't listed any properties yet. <br />
                Click "Create Landmark" to get started!
              </p>
            ) : (
              <>
                {/* Search input for landmarks - moved from its own CardHeader */}
                <div className="relative w-full mb-4">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search properties by title..."
                    value={searchTermLandmarks}
                    onChange={(e) => setSearchTermLandmarks(e.target.value)}
                    className="pl-8 w-full"
                  />
                </div>
                {filteredLandmarks.length > 0 ? (
                <ul className="space-y-3 max-h-72 overflow-y-auto">
                  {filteredLandmarks.map((landmark) => (
                    <li
                      key={landmark.id}
                      // Stack vertically on small screens, row on sm and up
                      className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b pb-2 last:border-b-0 pt-2 space-y-2 sm:space-y-0"
                    >
                      {/* Group title and dates */}
                      <div className="flex-grow sm:mr-4"> {/* Title and creation/update dates */}
                        {" "}
                        <div className="flex items-center gap-2"> {/* Flex container for title and rating */}
                          <span className="font-medium text-sm block">
                            {landmark.title.split(" ").length > 4 // Adjusted title length check
                              ? landmark.title.split(" ").slice(0, 4).join(" ") +
                                "..."
                              : landmark.title}
                          </span>
                          {landmark.reviews && landmark.reviews.length > 0 && (
                            <span className="flex items-center text-xs text-yellow-600">
                              <Star className="w-3 h-3 mr-0.5 fill-current" />
                              {(
                                landmark.reviews.reduce(
                                  (sum, review) => sum + (review.overallRating || 0),
                                  0
                                ) / landmark.reviews.length
                              ).toFixed(1)}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground block">
                          Created:{" "}
                          {landmark.createAt // Use custom formatter
                            ? formatDatePretty(landmark.createAt)
                            : "N/A"}{" "}
                          | Last Updated:{" "}
                          {landmark.updateAt // Use custom formatter
                            ? formatDatePretty(landmark.updateAt)
                            : "N/A"}
                        </span>
                      </div>
                      {/* Update Button */}
                      <span className="flex-shrink-0 self-start sm:self-center">
                        {" "}
                        {/* Align button left on small screens, wrap Button with Link */}
                        <Link to={`/user/update-landmark/${landmark.id}`}>
                          <Button variant="outline" size="sm">
                            Update {/* Button text */}
                          </Button>
                        </Link>{" "}
                        {/* Correct closing tag for Link */}
                      </span>
                      {/* Add links/buttons to edit/view property details later */}
                      {/* <Button variant="ghost" size="sm">View</Button> */}
                    </li>
                  ))}
                </ul>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No properties found matching your search "{searchTermLandmarks}".
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
        {/* Booking Requests Section (Takes full width on small, 2/3 on large) */}
        <Card className="md:col-span-1 lg:col-span-3">
          {" "}
          {/* Renamed and updated to show all bookings */}
          <CardHeader className="pb-2">
            <CardTitle>
              All Guest Bookings ({filteredAllBookings.length})
            </CardTitle>
          </CardHeader>
          {/* Search input for all bookings */}
          <CardHeader className="pt-0 pb-2">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by ID, property, guest..."
                value={searchTermAllBookings}
                onChange={(e) => setSearchTermAllBookings(e.target.value)}
                className="pl-8 w-full"
              />
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {" "}
            {bookings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Added Booking ID for clarity */}
                    <TableHead>ID</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Total guest</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead className="text-center">Nights</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {/* Add Action column */}
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAllBookings.length > 0
                    ? filteredAllBookings.map((booking) => (
                        <TableRow
                          key={booking.id}
                          className="hover:bg-muted/50"
                        >
                          <TableCell className="font-medium text-sm">
                            {booking.id}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {booking.landmark?.title
                              ? booking.landmark.title.split(" ").length > 3
                                ? booking.landmark.title
                                    .split(" ")
                                    .slice(0, 3)
                                    .join(" ") + "..."
                                : booking.landmark.title
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {booking.profile?.firstname || "Guest"}
                            {booking.profile?.lastname
                              ? " " + booking.profile.lastname
                              : ""}
                          </TableCell>
                          <TableCell className="text-sm">
                            {booking.profile?.totalGuest || "N/A"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {booking.checkIn
                              ? formatDatePretty(booking.checkIn)
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {booking.checkOut
                              ? formatDatePretty(booking.checkOut)
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {booking.totalNights}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatNumber(booking.total)}฿
                          </TableCell>
                          <TableCell className="text-center">
                            {(() => {
                              const props = getActionButtonProps(booking);
                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={props.onClick}
                                  disabled={props.disabled}
                                  className={props.className || ""}
                                >
                                  {props.text}
                                </Button>
                              );
                            })()}
                          </TableCell>
                        </TableRow>
                      ))
                    : renderNoResultsMessage(9, searchTermAllBookings)}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                No bookings found.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmed Bookings Section (formerly Recent Bookings) */}
      <Card>
        {" "}
        <CardHeader className="pb-2">
          <CardTitle>
            Confirmed Bookings ({filteredConfirmedBookings.length})
          </CardTitle>
        </CardHeader>
        {/* Search input for confirmed bookings */}
        <CardHeader className="pt-0 pb-2">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by ID, property, guest..."
              value={searchTermConfirmedBookings}
              onChange={(e) => setSearchTermConfirmedBookings(e.target.value)}
              className="pl-8 w-full"
            />
          </div>
        </CardHeader>
        <CardContent>
          {bookings.filter((b) => b.paymentStatus).length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead className="text-center">Nights</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {/* End of TableHeads */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConfirmedBookings.length > 0
                  ? filteredConfirmedBookings.map((booking) => (
                      <TableRow key={booking.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-sm">
                          {booking.id}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {booking.landmark?.title
                            ? booking.landmark.title.split(" ").length > 10
                              ? booking.landmark.title
                                  .split(" ")
                                  .slice(0, 10)
                                  .join(" ") + "..."
                              : booking.landmark.title
                            : "N/A"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {booking.checkIn
                            ? formatDatePretty(booking.checkIn)
                            : "N/A"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {booking.checkOut
                            ? formatDatePretty(booking.checkOut)
                            : "N/A"}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {booking.totalNights}
                        </TableCell>
                        <TableCell className="text-sm">
                          {booking.profile?.firstname || "Guest"}
                          {booking.profile?.lastname
                            ? " " + booking.profile.lastname
                            : ""}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatNumber(booking.total)}฿
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={
                              booking.paymentStatus
                                ? "text-green-600 font-medium"
                                : "text-gray-500"
                            }
                          >
                            {booking.paymentStatus ? "Confirmed" : "Pending"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  : renderNoResultsMessage(8, searchTermConfirmedBookings)}
              </TableBody>
            </Table>
          ) : (
            <p>No confirmed bookings found.</p>
          )}{" "}
          {/* Consider enhancing empty state */}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {" "}
        {/* Added md:grid-cols-2 */}
        {/* Performance Graphs using shadcn/ui charts */}
        <Card className="md:col-span-1 lg:col-span-12">
          {" "}
          {/* Adjusted spans */}
          <CardHeader>
            <CardTitle>Income (Last 30 Days)</CardTitle>
            <CardDescription>
              Daily income from confirmed bookings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {incomeData.length > 0 ? (
              <ChartContainer
                config={incomeChartConfig}
                className="min-h-[200px] w-full max-w-lg mx-auto"
              >
                {" "}
                {/* Added max-w-lg and mx-auto */}
                <BarChart // Changed from LineChart to BarChart
                  accessibilityLayer
                  data={incomeData}
                  margin={{
                    // Adjust margins as needed
                    left: 12,
                    right: 12,
                    top: 5,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date" // Use the short date for the axis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    // tickFormatter={(value) => value.slice(-2)} // Example: show only day part if needed
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={formatCurrency} // Use custom currency formatter
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar
                    dataKey="income"
                    fill={incomeChartConfig.income.color}
                    radius={4}
                  />{" "}
                  {/* Changed from Line to Bar */}
                </BarChart>{" "}
                {/* Corrected closing tag */}
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not enough data for income chart.
              </p>
            )}
          </CardContent>
        </Card>
        {/* Booking Trend Chart */}
        <Card className="md:col-span-1 lg:col-span-12">
          {" "}
          {/* Adjusted spans */}
          <CardHeader>
            <CardTitle>Booking Trends (Last 30 Days)</CardTitle>
            <CardDescription>
              Daily count of new bookings received.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bookingTrendData.length > 0 ? (
              <ChartContainer
                config={bookingTrendChartConfig}
                className="min-h-[200px] w-full max-w-lg mx-auto"
              >
                {" "}
                {/* Added max-w-lg and mx-auto */}
                <BarChart // Using BarChart for variety, LineChart is also fine
                  accessibilityLayer
                  data={bookingTrendData}
                  margin={{ left: 12, right: 12, top: 5, bottom: 5 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    allowDecimals={false} // Ensure whole numbers for counts
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar
                    dataKey="count"
                    fill={bookingTrendChartConfig.count.color}
                    radius={4}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not enough data for booking trend chart.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default HostDashboard;
