-- Install events (POST /events): Discord's APPLICATION_AUTHORIZED webhook event registers a server before anyone runs a
-- command, and the bot says hello there once. Discord retries an event it thinks failed, with the same body, so the
-- hello is keyed by the event's own timestamp: a retry finds it here and posts nothing; a later install posts again.
-- installed_at now holds the time of the install event, or of the earliest command when webhook events are off.
ALTER TABLE installs ADD COLUMN welcomed TEXT;  -- timestamp of the install event that got the hello
