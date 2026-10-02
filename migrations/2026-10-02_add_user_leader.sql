-- Each non-admin user can have an admin "leader". Requirements created by
-- non-admins are auto-assigned to the creator's leader.
ALTER TABLE users
  ADD COLUMN leader_id int DEFAULT NULL,
  ADD KEY fk_user_leader (leader_id),
  ADD CONSTRAINT fk_user_leader FOREIGN KEY (leader_id) REFERENCES users (id) ON DELETE SET NULL;
