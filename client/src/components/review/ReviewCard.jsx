import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StarRatingDisplay from "@/components/review/StarRatingDisplay"
import { formatDate } from "@/utils/formats"; // Assuming you have this utility
import { CircleUser } from "lucide-react";

const ReviewCard = ({ review }) => {
  if (!review) return null;

  const reviewerName = review.profile ? `${review.profile.firstName || ''} ${review.profile.lastName || ''}`.trim() : "Anonymous";
  const reviewerInitials = review.profile ? `${review.profile.firstName?.[0] || ''}${review.profile.lastName?.[0] || ''}` : "AN";
  const reviewerImage = review.profile?.imageUrl;

  return (
    <div className="py-6 border-b border-gray-200 last:border-b-0">
      <div className="flex items-start space-x-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src={reviewerImage} alt={reviewerName} />
          <AvatarFallback>
            {reviewerImage ? reviewerInitials : <CircleUser size={24} />}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">{reviewerName}</h4>
              <p className="text-xs text-gray-500">{formatDate(review.createdAt)}</p>
            </div>
            <StarRatingDisplay rating={review.overallRating || review.rating || 0} />
          </div>
          {review.text && (
            <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
              {review.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewCard;