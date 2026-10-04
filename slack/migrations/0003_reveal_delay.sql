-- Who's Bluffing for Slack: the reveal window per workspace, set with `/bluff setup ... reveal N`. Additive only.
ALTER TABLE installs ADD COLUMN reveal_delay_h INTEGER;  -- hours from the post to the reveal, 2 to 23; NULL = 8
