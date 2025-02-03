-- Required for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Required to generate UUIDs for sessions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS public;

do $$ begin
  CREATE TYPE public.roles as ENUM('base', 'advanced', 'admin');
exception
  when duplicate_object then null;
end $$;

-- Clear exiisting table
DROP TABLE public.users cascade;
DROP TABLE public.sessions cascade;
DROP FUNCTION IF EXISTS public.upsert_user;

-- Create user table
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(20) NOT NULL,
  role public.roles NOT NULL DEFAULT 'base',
  email_address VARCHAR(80) NOT NULL UNIQUE,
  password TEXT, -- Use pgcrypto for password hashing
  first_name VARCHAR(20) NOT NULL,
  last_name VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create session table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id BIGINT REFERENCES public.users (id) ON DELETE CASCADE,
  expires TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments to describe the tables and their purpose
COMMENT ON DATABASE public IS 'SvelteKit public';
COMMENT ON TABLE public.users IS 'Table to store user information';
COMMENT ON TABLE public.sessions IS 'Table to manage user sessions';

-- Enable Row-Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- authenticate a user
CREATE OR REPLACE FUNCTION public.authenticate(input JSONB)
RETURNS JSONB AS $$
DECLARE
  input_email VARCHAR(80) := LOWER(TRIM(input->>'email'));
  input_password VARCHAR(80) := (input->>'password');
  authenticated_user RECORD;
BEGIN
  if input_email IS NULL OR input_password IS NULL THEN
    RETURN jsonb_build_object(
      'statusCode', 400,
      'status', 'Email and password are required.'
    );
  end if;

  perform id, username, role, first_name, last_name
  into authenticated_user
  from public.users 
  where email_address = input_email and password = crypt(input_password, password)
  limit 1;

  if not found then
    return jsonb_build_object(
      'statusCode', 401,
      'status', 'Invalid credentials.'
    );
  end if;

  return jsonb_build_object(
    'statusCode', 200,
    'status', 'Login successful.',
    'user', jsonb_build_object(
      'id', authenticated_user.id,
      'username', authenticated_user.username,
      'role', authenticated_user.role,
      'email', input_email,
      'firstName', authenticated_user.first_name,
      'lastName', authenticated_user.last_name
    ),
    'sessionId', public.create_session(authenticated_user.id)
  );
end
$$ language plpgsql;

-- Register a new user
create or replace function public.register(input JSONB)
returns JSONB as $$
declare
  input_username varchar(23) := trim(input->>'username');
  input_email varchar(80) := lower(trim(input->>'email'));
  input_first_name varchar(20) := trim(input->>'first_name');
  input_last_name varchar(20) := trim(input->>'last_name');
  input_password varchar(80) := (input->>'password');
  new_user RECORD;
begin
  -- Check if email already exists
  select id into new_user from public.users where email_address = input_email;

  if not found then
    insert into public.users (username, role, email_address, password, first_name, last_name)
    values (
      input_username,
      'base',
      input_email,
      crypt(input_password, gen_salt('bf', 8)),
      input_first_name,
      input_last_name
    )
    returning id, username, role, email_address, first_name, last_name
    into new_user;

    return jsonb_build_object(
      'sessionId', public.create_session(new_user.id),
      'user', jsonb_build_object(
        'id', new_user.id,
        'username', new_user.username,
        'role', new_user.role,
        'email', new_user.email_address,
        'firstName', new_user.first_name,
        'lastName', new_user.last_name
      )
    );
  else
    return jsonb_build_object('statusCode', 409,' status', 'Email already exists');
  end if;
end;
$$ language plpgsql;

-- Create a session for the user
create or replace function public.create_session(user_id bigint)
returns uuid as $$
declare
  session_id UUID;
begin
  delete from public.sessions where public.sessions.user_id = $1;
  insert into public.sessions (user_id)
  values ($1);

  return session_id;
end;
$$ language plpgsql;

-- Create get_session function
CREATE OR REPLACE FUNCTION public.get_session(input_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'id', sessions.user_id,
      'username', users.username,
      'role', users.role,
      'email', users.email_address,
      'first_name', users.first_name,
      'last_name', users.last_name,
      'created_at', users.created_at,
      'expires', sessions.expires
    )
    FROM sessions
    INNER JOIN users ON sessions.user_id = users.id
    WHERE sessions.id = input_session_id
      AND sessions.expires > CURRENT_TIMESTAMP
    LIMIT 1
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.start_gmail_user_session(input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    input_email VARCHAR(80) := LOWER(TRIM(input->>'email'));
    input_first_name VARCHAR(20) := TRIM(input->>'first_name');
    input_last_name VARCHAR(20) := TRIM(input->>'last_name');
    input_username VARCHAR(23) := TRIM(input->>'username');
    user_session JSONB;
BEGIN
    -- Check if user exists
    SELECT jsonb_build_object(
        'id', public.create_session(users.id),
        'user', jsonb_build_object(
            'id', users.id,
            'username', users.username,
            'role', users.role,
            'email', input_email,
            'first_name', users.first_name,
            'last_name', users.last_name
        )
    ) INTO user_session
    FROM users
    WHERE email_address = input_email;

    -- If user does not exist, insert new user
    IF NOT FOUND THEN
        INSERT INTO users (role, username, email_address, first_name, last_name)
        VALUES ('base', input_username, input_email, input_first_name, input_last_name)
        RETURNING jsonb_build_object(
            'id', public.create_session(users.id),
            'user', jsonb_build_object(
                'id', users.id,
                'username', users.username,
                'role', 'base',
                'email', input_email,
                'first_name', input_first_name,
                'last_name', input_last_name
            )
        ) INTO user_session;
    END IF;

    RETURN user_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_session(user_id BIGINT)
  RETURNS VOID
  LANGUAGE sql
  AS $$
  DELETE FROM public.sessions WHERE user_id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.reset_password(input_id BIGINT, input_password TEXT)
  RETURNS VOID
  LANGUAGE plpgsql
  AS $$
  BEGIN
    UPDATE users
    SET password = crypt(input_password, gen_salt('bf', 8))
    WHERE id = input_id;
  END;
$$;

CREATE OR REPLACE PROCEDURE public.upsert_user(input JSONB)
LANGUAGE plpgsql
AS $$
DECLARE
    input_id BIGINT := COALESCE((input->>'id')::BIGINT, 0);
    input_username VARCHAR(23) := TRIM(input->>'username');
    input_role public.roles := COALESCE((input->>'role')::public.roles, 'base');
    input_email VARCHAR(80) := LOWER(TRIM(input->>'email'));
    input_password TEXT := COALESCE((input->>'password'), '');
    input_first_name VARCHAR(20) := TRIM(input->>'first_name');
    input_last_name VARCHAR(20) := TRIM(input->>'last_name');
BEGIN
    IF input_id = 0 THEN
        INSERT INTO public.users (username, role, email_address, password, first_name, last_name)
        VALUES (
            input_username,
            input_role,
            input_email,
            crypt(input_password, gen_salt('bf', 8)),
            input_first_name,
            input_last_name
        );
    ELSE
        UPDATE public.users
        SET
            username = input_username,
            role = input_role,
            email_address = input_email,
            password = CASE WHEN input_password = '' THEN password ELSE crypt(input_password, gen_salt('bf', 8)) END,
            first_name = input_first_name,
            last_name = input_last_name
        WHERE id = input_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user(input_id BIGINT, input JSONB)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    input_username VARCHAR(20) := TRIM(input->>'username');
    input_email VARCHAR(80) := LOWER(TRIM(input->>'email'));
    input_password TEXT := COALESCE(input->>'password', '');
    input_first_name VARCHAR(20) := TRIM(input->>'first_name');
    input_last_name VARCHAR(20) := TRIM(input->>'last_name');
BEGIN
    UPDATE users
    SET
        username = input_username,
        email_address = input_email,
        password = CASE WHEN input_password = '' THEN password ELSE crypt(input_password, gen_salt('bf', 8)) END,
        first_name = input_first_name,
        last_name = input_last_name
    WHERE id = input_id;
END;
$$;


-- Allow users to access their own data
CREATE POLICY "Allow self-access" ON public.users
FOR SELECT USING (auth.uid()::text = id::text);

-- Allow users to manage their public.sessions
CREATE POLICY "Allow session management" ON public.sessions
FOR ALL USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);


call public.upsert_user('{"id":0, "username":"bb", "role":"admin", "email":"admin@example.com", "password":"admin123", "first_name":"Bucky", "last_name":"Badger"}'::jsonb);
call public.upsert_user('{"id":0, "username":"bbadger", "role":"advanced", "email":"advanced@example.com", "password":"teacher123", "first_name":"Bucky", "last_name":"Badger"}'::jsonb);
call public.upsert_user('{"id":0, "username":"bbadger2", "role":"base", "email":"base@example.com", "password":"student123", "first_name":"Bucky", "last_name":"Badger"}'::jsonb);