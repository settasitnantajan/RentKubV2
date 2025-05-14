import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StarRatingDisplay from "@/components/review/StarRatingDisplay"
import { formatDate } from "@/utils/formats"; // Assuming you have this utility
import { Button } from "@/components/ui/button"; // Import Button
import { CircleUser } from "lucide-react";

const ReviewCard = ({
  username,
  imageUrl,
  firstName,
  lastName,
  createdAt,
  rating,
  text
}) => {
  const [showFullText, setShowFullText] = useState(false);

  const MAX_TEXT_LENGTH = 200;

  console.log(username, imageUrl, firstName, lastName, createdAt, rating, text)
  // A basic check, though individual props being undefined is handled by fallbacks.
  // if (!createdAt || typeof rating === 'undefined') return null;

  // Prioritize username, then first/last name, then "Anonymous"
  const reviewerName = username ||
      `${firstName || ""} ${lastName || ""}`.trim() ||
      "Anonymous"
  const reviewerInitials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.trim() || "AN";

  return (
    <div className="py-6 border-b border-gray-200 last:border-b-0">
      <div className="flex items-start space-x-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src={imageUrl} alt={reviewerName} />
          <AvatarFallback>
            {/* Show initials if image was provided (even if it failed to load) AND initials are available, otherwise show icon */}
            {imageUrl && reviewerInitials ? reviewerInitials : <CircleUser size={24} />}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              {/* Ensure final name isn't an empty string */}
              <h4 className="text-sm font-semibold text-gray-900">{reviewerName === "" ? "Anonymous" : reviewerName}</h4>
              <p className="text-xs text-gray-500">{createdAt ? formatDate(createdAt) : "Date unknown"}</p>
            </div>
            <StarRatingDisplay rating={rating || 0} />
          </div>
          {text && text.length > 0 && (
            <div className="mt-2 text-xs text-gray-700">
              <p className="whitespace-pre-wrap">
                {showFullText || text.length <= MAX_TEXT_LENGTH
                  ? text
                  : `${text.substring(0, MAX_TEXT_LENGTH)}...`}
              </p>
              {text.length > MAX_TEXT_LENGTH && (
                <Button
                  variant="link"
                  className="p-0 mt-2 h-auto text-xs text-gray-800 font-extrabold underline hover:cursor-pointer hover:text-gray-400"
                  onClick={() => setShowFullText(!showFullText)}
                >
                  {showFullText ? "Show less" : "Show more"}
                </Button>
              )}
            </div>
          )}
          {!text && <p className="mt-2 text-sm text-gray-500 italic">No review text provided.</p>}
        </div>
      </div>
    </div>
  );
};

export default ReviewCard;