import { auth } from "@/lib/auth";
import { getFeedForViewer } from "@/lib/services/post-service";
import { PostComposer } from "@/components/feed/post-composer";
import { PostCard } from "@/components/feed/post-card";

export default async function FeedPage() {
  const session = await auth();
  const viewerUserId = session?.user?.id ?? null;
  const posts = await getFeedForViewer(viewerUserId);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-display text-2xl font-medium text-ink">Feed</h1>
      <div className="flex flex-col gap-4">
        {viewerUserId ? <PostComposer /> : null}
        {posts.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No posts yet. {viewerUserId ? "Share the first update." : "Sign in to see more."}
          </p>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} viewerUserId={viewerUserId} />)
        )}
      </div>
    </div>
  );
}
