"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ThumbsUp, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ReportButton } from "@/components/safety/report-button";
import { toast } from "@/components/ui/toaster";
import type { getFeedForViewer } from "@/lib/services/post-service";

type FeedPost = Awaited<ReturnType<typeof getFeedForViewer>>[number];

export function PostCard({ post, viewerUserId }: { post: FeedPost; viewerUserId: string | null }) {
  const router = useRouter();
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [reacting, setReacting] = useState(false);

  const authorSlug = post.author.personProfile?.slug;
  const authorName = post.author.personProfile?.displayName ?? post.author.name ?? "Someone";
  const initials = authorName.slice(0, 2).toUpperCase();

  async function handleReact() {
    if (!viewerUserId) {
      toast.error("Sign in to react to posts");
      return;
    }
    setReacting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/reactions`, { method: "POST" });
      if (!res.ok) throw new Error("Could not react");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not react");
    } finally {
      setReacting(false);
    }
  }

  async function handleComment() {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not comment");
      }
      setCommentText("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not comment");
    } finally {
      setSubmittingComment(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <Avatar>
            {post.author.image ? <AvatarImage src={post.author.image} alt={authorName} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            {authorSlug ? (
              <Link href={`/p/${authorSlug}`} className="font-medium text-ink hover:underline">
                {authorName}
              </Link>
            ) : (
              <span className="font-medium text-ink">{authorName}</span>
            )}
            <p className="text-xs text-ink-muted">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        <p className="whitespace-pre-wrap text-sm text-ink">{post.content}</p>

        <div className="flex items-center gap-4 border-t border-border pt-3 text-sm text-ink-muted">
          <Button variant="ghost" size="sm" onClick={handleReact} disabled={reacting}>
            <ThumbsUp className="h-4 w-4" />
            {post._count.reactions}
          </Button>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-4 w-4" />
            {post._count.comments}
          </span>
          <ReportButton targetType="POST" targetId={post.id} targetUserId={post.authorUserId} />
        </div>

        {post.comments.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            {post.comments.map((comment) => (
              <div key={comment.id} className="text-sm">
                <span className="font-medium text-ink">
                  {comment.author.personProfile?.displayName ?? comment.author.name}
                </span>{" "}
                <span className="text-ink-muted">{comment.content}</span>
              </div>
            ))}
          </div>
        ) : null}

        {viewerUserId ? (
          <div className="flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              maxLength={2000}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleComment();
              }}
            />
            <Button size="sm" onClick={handleComment} disabled={submittingComment || !commentText.trim()}>
              Send
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
