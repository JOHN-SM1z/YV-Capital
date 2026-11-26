import { SubmitButton } from "@/components/action-form";
import { toggleFollow } from "@/lib/actions/funding";
import { fmt } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";

/** Follow / unfollow toggle. Works without JavaScript; RLS decides who may follow what. */
export function FollowButton({
  startupId,
  name,
  following,
  t,
  size = "sm",
}: {
  startupId: string;
  name: string;
  following: boolean;
  t: Dictionary;
  size?: "sm" | "md";
}) {
  return (
    <form action={toggleFollow}>
      <input type="hidden" name="startup_id" value={startupId} />
      <input type="hidden" name="follow" value={following ? "0" : "1"} />
      <SubmitButton
        variant={following ? "secondary" : "ghost"}
        size={size}
        pendingLabel="…"
        aria-label={fmt(following ? t.follow.unfollowAria : t.follow.followAria, { name })}
      >
        {following ? `✓ ${t.follow.following}` : `+ ${t.follow.follow}`}
      </SubmitButton>
    </form>
  );
}
