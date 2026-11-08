import { Text } from 'react-native';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const HASHTAG_REGEX = /(#[a-zA-Z0-9_]+)/g;
const MENTION_REGEX = /(@[a-zA-Z0-9_-]+)/g;

// Static visual port of frontend/src/components/PostCard.tsx's renderContentWithLinks —
// same emerald coloring for links/hashtags/mentions, but no onPress (Faz 1 plan decision
// 4: feed card content is visual-only, nothing is tappable yet).
export function renderContentWithHighlights(content: string | undefined) {
  if (!content) return null;

  const urlParts = content.split(URL_REGEX);

  return urlParts.map((urlPart, urlIndex) => {
    if (urlPart.match(URL_REGEX)) {
      return (
        <Text key={`url-${urlIndex}`} className="font-medium text-emerald-500">
          {urlPart}
        </Text>
      );
    }

    const hashtagParts = urlPart.split(HASHTAG_REGEX);
    return hashtagParts.map((hashtagPart, hashtagIndex) => {
      if (hashtagPart.match(HASHTAG_REGEX)) {
        return (
          <Text key={`tag-${urlIndex}-${hashtagIndex}`} className="font-bold text-emerald-500">
            {hashtagPart}
          </Text>
        );
      }

      const mentionParts = hashtagPart.split(MENTION_REGEX);
      return mentionParts.map((mentionPart, mentionIndex) => {
        if (mentionPart.match(MENTION_REGEX)) {
          return (
            <Text key={`mention-${urlIndex}-${hashtagIndex}-${mentionIndex}`} className="font-bold text-emerald-500">
              {mentionPart}
            </Text>
          );
        }
        return mentionPart;
      });
    });
  });
}
