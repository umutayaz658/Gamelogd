import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bookmark, Heart, MessageCircle, Repeat2, Share2 } from 'lucide-react-native';

import { Image } from '@/components/ui/Image';
import { Post } from '@/types';
import { formatCount, formatHandle, getAbsoluteDateTime, getImageUrl, getRelativeTime, resolveAuthorDisplay } from '@/lib/utils';
import { strings } from '@/lib/strings';
import { renderContentWithHighlights } from './contentHighlights';
import PostMediaGrid, { GridMediaItem } from './PostMediaGrid';
import ReviewCardReadOnly from './ReviewCardReadOnly';

interface PostCardReadOnlyProps {
  post: Post;
  showAbsoluteTimestamp?: boolean;
  repostedBy?: { name: string };
}

function getPostMediaItems(p: Pick<Post, 'media' | 'media_file' | 'image' | 'media_type' | 'gif_url'>): GridMediaItem[] {
  if (p.media && p.media.length > 0) {
    return p.media.map((m) => ({ url: getImageUrl(m.file), type: m.media_type }));
  }
  if (p.media_file || p.image) {
    return [{ url: getImageUrl(p.media_file || p.image || ''), type: p.media_type === 'video' ? 'video' : 'image' }];
  }
  if (p.gif_url) {
    return [{ url: p.gif_url, type: 'image' }];
  }
  return [];
}

// Read-only port of frontend/src/components/PostCard.tsx — full visual parity (avatar/
// author identity incl. project-or-org authorship via resolveAuthorDisplay, media grid,
// nested quote-post/quote-review embeds, static poll bars, news-attached mini card).
// Every action is still inert and the card body doesn't navigate on tap (Faz 1 decision
// 4), but Faz 2 decision 1 now wires the author avatar+name/handle to navigate — web
// links organisation/project authors too, but those profile screens don't exist on
// mobile yet (Faz 6), so only author.type === 'user' is tappable here.
export default function PostCardReadOnly({ post, showAbsoluteTimestamp, repostedBy }: PostCardReadOnlyProps) {
  const author = resolveAuthorDisplay(post);
  const quotedAuthor = post.repost_details ? resolveAuthorDisplay(post.repost_details) : null;

  const isEmptyRepostShell =
    !post.content && !post.image && !post.media_file && !post.gif_url && (!post.poll_options || post.poll_options.length === 0);
  const isDirectRepost = post.repost_parent && isEmptyRepostShell;
  const isDirectRepostReview = post.repost_parent_review && isEmptyRepostShell;

  if (isDirectRepost && post.repost_details) {
    return (
      <PostCardReadOnly
        post={post.repost_details}
        showAbsoluteTimestamp={showAbsoluteTimestamp}
        repostedBy={{ name: post.user.real_name || post.user.username }}
      />
    );
  }

  if (isDirectRepostReview && post.repost_review_details) {
    return (
      <ReviewCardReadOnly
        review={post.repost_review_details}
        showAbsoluteTimestamp={showAbsoluteTimestamp}
        repostedBy={{ name: post.user.real_name || post.user.username }}
      />
    );
  }

  const mediaItems = getPostMediaItems(post);
  const pollTotal = post.poll_results?.counts.reduce((a, b) => a + b, 0) ?? 0;

  return (
    <View className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      {repostedBy && (
        <View className="mb-2 flex-row items-center gap-2 pl-12">
          <Repeat2 size={14} color="#71717a" />
          <Text className="text-xs font-bold text-zinc-500">
            {repostedBy.name} {strings.reposted}
          </Text>
        </View>
      )}

      <View className="flex-row gap-4">
        <Pressable disabled={author.type !== 'user'} onPress={() => router.push(`/${author.slug}` as never)}>
          <Image source={{ uri: getImageUrl(author.avatar, author.name) }} className="h-10 w-10 rounded-full bg-zinc-800" />
        </Pressable>

        <View className="flex-1">
          {!!post.reply_to_username && !post.news_details && (
            <View className="mb-1 flex-row items-center gap-1">
              <Text className="text-sm text-zinc-500">{strings.replyingTo}</Text>
              <Text className="text-sm text-emerald-500">{formatHandle(post.reply_to_username)}</Text>
            </View>
          )}

          <Pressable
            disabled={author.type !== 'user'}
            onPress={() => router.push(`/${author.slug}` as never)}
            className="mb-1 flex-row flex-wrap items-center gap-1.5"
          >
            <Text numberOfLines={1} className="shrink font-bold text-white">
              {author.name}
            </Text>
            {author.type === 'user' ? (
              <Text numberOfLines={1} className="shrink text-sm text-zinc-500">
                {formatHandle(author.slug.toString().toLowerCase())}
              </Text>
            ) : (
              <View className="rounded border border-zinc-800 bg-zinc-800 px-2 py-0.5">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{author.type}</Text>
              </View>
            )}
            <Text className="text-sm text-zinc-700">•</Text>
            <Text className="flex-shrink-0 text-sm text-zinc-500">
              {showAbsoluteTimestamp ? getAbsoluteDateTime(post.timestamp) : getRelativeTime(post.timestamp)}
            </Text>
          </Pressable>

          {!!post.title && <Text className="mb-2 text-xl font-bold leading-tight text-blue-400">{post.title}</Text>}

          {!!post.content && (
            <Text className="mb-3 leading-relaxed text-zinc-300">{renderContentWithHighlights(post.content)}</Text>
          )}

          {mediaItems.length > 0 && <View className="mb-3">{<PostMediaGrid items={mediaItems} />}</View>}

          {post.repost_details && quotedAuthor && (
            <View className="mb-3 gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/30 p-3.5">
              <View className="flex-row items-center gap-2">
                <Image source={{ uri: getImageUrl(quotedAuthor.avatar, quotedAuthor.name) }} className="h-8 w-8 rounded-full bg-zinc-800" />
                <View className="flex-shrink flex-row flex-wrap items-center gap-1.5">
                  <Text className="text-sm font-bold text-white">{quotedAuthor.name}</Text>
                  {quotedAuthor.type === 'user' && (
                    <Text className="text-sm text-zinc-500">{formatHandle(quotedAuthor.slug.toString().toLowerCase())}</Text>
                  )}
                  <Text className="text-sm text-zinc-600">•</Text>
                  <Text className="text-sm text-zinc-500">{getRelativeTime(post.repost_details.timestamp)}</Text>
                </View>
              </View>
              {!!post.repost_details.title && <Text className="text-sm font-bold text-white">{post.repost_details.title}</Text>}
              <Text numberOfLines={3} className="text-sm leading-relaxed text-zinc-300">
                {renderContentWithHighlights(post.repost_details.content)}
              </Text>
            </View>
          )}

          {post.repost_review_details && (
            <View className="mb-3 gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/30 p-3.5">
              <View className="flex-row items-center gap-2">
                <Image
                  source={{ uri: getImageUrl(post.repost_review_details.user.avatar, post.repost_review_details.user.username) }}
                  className="h-8 w-8 rounded-full bg-zinc-800"
                />
                <View className="flex-shrink flex-row flex-wrap items-center gap-1.5">
                  <Text className="text-sm font-bold text-white">
                    {post.repost_review_details.user.real_name || post.repost_review_details.user.username}
                  </Text>
                  <Text className="text-sm text-zinc-500">{formatHandle(post.repost_review_details.user.username.toLowerCase())}</Text>
                  <Text className="text-sm text-zinc-600">•</Text>
                  <Text className="text-sm text-zinc-500">{getRelativeTime(post.repost_review_details.timestamp)}</Text>
                </View>
              </View>
              <View className="flex-row gap-3">
                {post.repost_review_details.game?.cover_image && (
                  <Image
                    source={{ uri: getImageUrl(post.repost_review_details.game.cover_image) }}
                    className="h-24 w-16 rounded-md bg-zinc-800"
                    contentFit="cover"
                  />
                )}
                <View className="flex-1">
                  <Text className="mb-0.5 text-sm font-bold text-white">{post.repost_review_details.game?.title}</Text>
                  <Text className="mb-1 text-xs font-bold text-emerald-500">
                    Logged {post.repost_review_details.rating}/10
                  </Text>
                  {post.repost_review_details.contains_spoilers ? (
                    <Text className="text-sm italic text-zinc-500">Contains spoilers — hidden.</Text>
                  ) : (
                    <Text numberOfLines={3} className="text-sm leading-relaxed text-zinc-300">
                      {post.repost_review_details.content || strings.noReviewWritten}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {!!post.poll_options && post.poll_options.length > 0 && (
            <View className="mb-3 overflow-hidden rounded-xl border border-zinc-800">
              {post.poll_options.map((option, idx) => {
                const count = post.poll_results?.counts[idx] ?? 0;
                const pct = pollTotal > 0 ? Math.round((count / pollTotal) * 100) : 0;
                const isMine = post.poll_results?.user_choice === idx;
                return (
                  <View key={idx} className="relative border-b border-zinc-800 bg-zinc-950/50 p-3 last:border-0">
                    <View style={{ width: `${pct}%` }} className={`absolute bottom-0 left-0 top-0 ${isMine ? 'bg-emerald-500/20' : 'bg-zinc-800/30'}`} />
                    <View className="z-10 flex-row items-center justify-between">
                      <Text className={`text-sm font-medium ${isMine ? 'text-emerald-400' : 'text-zinc-300'}`}>{option}</Text>
                      <Text className="text-xs text-zinc-500">{pct}%</Text>
                    </View>
                  </View>
                );
              })}
              <View className="border-t border-zinc-800 bg-zinc-900 p-2">
                <Text className="text-center text-xs text-zinc-500">
                  {formatCount(pollTotal)} {strings.votes} · {strings.finalResults}
                </Text>
              </View>
            </View>
          )}

          {post.news_details && (
            <View className="mb-3 flex-row overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/50">
              {post.news_details.image_url && (
                <Image source={{ uri: post.news_details.image_url }} className="h-24 w-24" contentFit="cover" />
              )}
              <View className="flex-1 justify-center p-3">
                <Text className="mb-1 text-xs text-zinc-500">{post.news_details.source_name}</Text>
                <Text numberOfLines={2} className="text-sm font-bold leading-tight text-white">
                  {post.news_details.title}
                </Text>
              </View>
            </View>
          )}

          <View className="mt-2 flex-row items-center justify-between border-t border-zinc-800/50 pt-3">
            <View className="flex-1 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <MessageCircle size={16} color="#71717a" />
                <Text className="text-sm text-zinc-500">{formatCount(post.replies_count || 0)}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Repeat2 size={16} color="#71717a" />
                <Text className="text-sm text-zinc-500">{formatCount(post.reposts_count || 0)}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Heart size={16} color="#71717a" />
                <Text className="text-sm text-zinc-500">{formatCount(post.likes_count || 0)}</Text>
              </View>
              <Share2 size={16} color="#71717a" />
            </View>
            <Bookmark size={16} color="#71717a" style={{ marginLeft: 4 }} />
          </View>
        </View>
      </View>
    </View>
  );
}
