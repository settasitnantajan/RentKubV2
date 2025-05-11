import ReviewCard from "./ReviewCard";

const ReviewList = ({ reviews, maxReviewsToShow = 5 }) => {
  if (!reviews || reviews.length === 0) {
    return <p className="text-gray-600 py-4">Be the first to review this spot!</p>;
  }

  // const [showAll, setShowAll] = useState(false);
  // const displayedReviews = showAll ? reviews : reviews.slice(0, maxReviewsToShow);
  // For now, just show all reviews passed to it. Pagination/ShowMore can be added later.

  return (
    <div className="space-y-0"> {/* No space-y here, ReviewCard handles its own padding/border */}
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
      {/* {reviews.length > maxReviewsToShow && !showAll && (
        <Button variant="outline" onClick={() => setShowAll(true)} className="mt-4">
          Show all {reviews.length} reviews
        </Button>
      )} */}
    </div>
  );
};

export default ReviewList;