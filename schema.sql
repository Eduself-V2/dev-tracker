-- Dev Tracker MySQL Schema
-- Run this against a fresh MySQL 8 database to set up all tables.

CREATE DATABASE IF NOT EXISTS dev_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE dev_tracker;

CREATE TABLE users (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(120) NOT NULL,
  email varchar(190) NOT NULL,
  mobile varchar(40) DEFAULT NULL,
  username varchar(60) NOT NULL,
  password_hash varchar(255) NOT NULL,
  role enum('admin','developer','tester') NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  password_reset_required tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  UNIQUE KEY username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE projects (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(120) NOT NULL,
  description text,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE requirements (
  id int NOT NULL AUTO_INCREMENT,
  title varchar(200) NOT NULL,
  description text,
  status enum('open','in_testing','needs_fix','confirmed','pushed_to_production') NOT NULL DEFAULT 'open',
  priority enum('low','medium','high') NOT NULL DEFAULT 'medium',
  developer_id int NOT NULL,
  tester_id int DEFAULT NULL,
  test_cycles int NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  project_id int NOT NULL,
  assignee_id int DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_req_status (status),
  KEY idx_req_dev (developer_id),
  KEY idx_req_tester (tester_id),
  KEY fk_req_project (project_id),
  KEY fk_req_assignee (assignee_id),
  CONSTRAINT fk_req_assignee FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_req_dev FOREIGN KEY (developer_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_req_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT,
  CONSTRAINT fk_req_tester FOREIGN KEY (tester_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE requirement_events (
  id int NOT NULL AUTO_INCREMENT,
  requirement_id int NOT NULL,
  kind enum('created','transitioned','comment','assigned') NOT NULL,
  from_status varchar(40) DEFAULT NULL,
  to_status varchar(40) DEFAULT NULL,
  note text,
  actor_id int NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_evt_req (requirement_id),
  KEY fk_evt_actor (actor_id),
  CONSTRAINT fk_evt_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_evt_req FOREIGN KEY (requirement_id) REFERENCES requirements (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE requirement_comments (
  id int NOT NULL AUTO_INCREMENT,
  requirement_id int NOT NULL,
  body text NOT NULL,
  author_id int NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cmt_req (requirement_id),
  KEY fk_cmt_author (author_id),
  CONSTRAINT fk_cmt_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_cmt_req FOREIGN KEY (requirement_id) REFERENCES requirements (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
