*This project has been created as part of the 42 curriculum by mawako, sumedai, kinamura, sninomiy.*

# Werewolf Transcendence

## Description

**Werewolf Transcendence** is a real-time multiplayer social deduction game (in the style of *One Night Ultimate Werewolf*), built as our ft_transcendence project. Rather than the classic Pong project, our team chose to build a browser-based Werewolf game with live chat, user profiles, and a friends system, all running over WebSockets.

Key features:
- Account creation and login (email + password, hashed with bcrypt).
- Real-time private and group chat between users.
- A full multiplayer Werewolf game for 3-5 players: lobby, role assignment, a simultaneous night phase (Werewolf reveal / Seer inspection / Robber swap), discussion, voting, and a result screen, with automatic reconnection if a player's connection drops mid-game.
- User profiles with win/loss statistics and match history.
- A friends system (add, remove, list).

## Instructions

### Prerequisites
- Docker and Docker Compose.
- No local Node.js/PostgreSQL installation is required; everything runs inside containers.

### Setup
1. Copy the environment template and fill in real values:
   ```bash
   cp .env.example .env
   ```
   Required variables:
   - `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` — PostgreSQL credentials.
   - `JWT_SECRET` — secret used to sign authentication tokens. Generate one with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```
2. Start the whole stack with a single command from the project root:
   ```bash
   docker compose up
   ```
3. Open the app: **https://localhost**

   All browser-facing traffic (the frontend, the REST API, and the WebSocket/Socket.IO connections for chat and the Werewolf game) is served over HTTPS through an nginx reverse proxy (`nginx/`), which terminates TLS with a self-signed certificate (`nginx/certs/`) and forwards to the frontend and backend containers over plain HTTP inside the Docker network. Plain HTTP requests to port 80 are redirected to HTTPS. Since the certificate is self-signed, your browser will show a security warning the first time — this is expected for a local/evaluation setup; proceed past it.
   The backend and frontend containers are not published to the host directly; `https://localhost` (nginx) is the only entry point.

The database schema is created automatically on first boot (TypeORM `synchronize`), so no manual migration step is required.

## Resources

- [NestJS documentation](https://docs.nestjs.com/)
- [Next.js documentation](https://nextjs.org/docs)
- [TypeORM documentation](https://typeorm.io/)
- [Socket.IO documentation](https://socket.io/docs/v4/)
- [One Night Ultimate Werewolf — rules reference](https://en.wikipedia.org/wiki/One_Night_Ultimate_Werewolf) (used as the basis for our simplified Werewolf/Villager/Seer/Robber ruleset)

### AI usage

We used Claude Code (Anthropic) throughout this project as a pair-programming assistant, primarily for the Werewolf game backend/frontend and the profile/friends module. Concretely, AI assistance was used for:
- Designing and implementing the real-time Werewolf game engine (`backend/src/werewolf/`): the WebSocket gateway, the in-memory game service, and the underlying game-rules logic (role assignment, night actions, voting, win conditions).
- Diagnosing and fixing real bugs found through manual play-testing: a role-misattribution bug where the player who was robbed could act again as the robber, a memory leak where abandoned in-progress games were never removed from memory, missing automatic reconnection after a network drop, and a stale-lobby bug where a finished game could be silently revived with old players still in it.
- Writing the automated Jest test suite for the game rules (`werewolf.domain.spec.ts`) and a set of scripted end-to-end checks (creating games, playing full 3/4/5-player matches, forcing disconnects/reconnects, verifying cleanup) run against the live Docker stack to confirm each fix.
- Implementing the profile/friends/match-history module (`backend/src/api/users/`) and its frontend pages.
- Drafting this README.

Every change was reviewed, run, and manually tested by the team in the running application before being accepted; AI output was not merged blindly.

## Team Information

| Login | Role(s) | Responsibilities |
|---|---|---|
| mawako | Product Owner, Tech Lead | Project direction, module selection, architecture decisions, core Werewolf game implementation |
| sumedai | Developer | _TODO: fill in_ |
| kinamura | Developer | _TODO: fill in_ |
| sninomiy | Developer | _TODO: fill in_ |

*(Role assignment is provisional and should be updated to reflect what each member actually worked on.)*

## Project Management

- **Task organization**: work was split by feature area (auth/chat, Werewolf game, profile/friends) among team members.
- **Communication**: Discord for async updates, plus in-person sessions for planning and pairing.
- **Tracking**: informal — discussed and assigned directly rather than through a formal ticket board.

## Technical Stack

- **Frontend**: Next.js (App Router) + TypeScript, socket.io-client for real-time communication.
- **Backend**: NestJS + TypeScript, with `@nestjs/websockets` (Socket.IO adapter) for real-time gateways and `@nestjs/jwt` for authentication.
- **Database**: PostgreSQL, accessed through TypeORM. Chosen because the project already required a relational schema (users, chat rooms/messages, friendships, match results) with clear relations between them, and TypeORM integrates directly with NestJS's dependency injection.
- **Containerization**: Docker Compose (`postgres`, `backend`, `frontend`, `nginx` services), started with a single `docker compose up`.
- **HTTPS**: nginx terminates TLS with a self-signed certificate and reverse-proxies to the frontend and backend; it is the only service exposed to the host.

## Database Schema

| Entity | Key fields | Relationships |
|---|---|---|
| `User` | `userId` (PK), `userName`, `emailAddress`, `password`, `timeStamp` | many-to-many with `Chatroom` |
| `Chatroom` | `roomId` (PK, uuid), `roomName`, `roomType`, `save` | many-to-many with `User` (via `chatroom_users`) |
| `Message` | `msgId` (PK), `text`, `timeStamp` | many-to-one `Chatroom`, many-to-one `User` |
| `Friend` | `id` (PK), `userId`, `friendUserId`, `timeStamp` | logical reference to `User.userId` on both sides (one row per direction) |
| `MatchResult` | `id` (PK), `gameId`, `userId`, `finalRole`, `won`, `playerCount`, `timeStamp` | logical reference to `User.userId`; one row per player per completed Werewolf match |

The Werewolf game's live state (current phase, votes, night-action results) is kept in memory for the duration of a match and is only persisted to `MatchResult` once a match reaches its result screen — the game does not need a full match to be replayed from the database, only the final outcome for statistics/history.

## Features List

| Feature | Description | Worked on by |
|---|---|---|
| Signup / Login | Email + password authentication, JWT stored in an httpOnly cookie | mawako |
| Real-time chat | Private and group chat rooms, message persistence, invites | _(pre-existing, contributor TBD)_ |
| Werewolf game | Full multiplayer game loop: lobby, roles, simultaneous night actions, discussion, voting, result, restart | mawako (with Claude Code) |
| Reconnection handling | Automatic rejoin after a dropped connection mid-game | mawako (with Claude Code) |
| Profile page | View a user's join date, win/loss stats, and match history | mawako (with Claude Code) |
| Friends system | Add/remove/list friends by username | mawako (with Claude Code) |

## Modules

We targeted the required **14 points**:

| Module | Category | Type | Points | Notes |
|---|---|---|---|---|
| Use a framework for frontend and backend | Web | Major | 2 | Next.js + NestJS |
| Use an ORM for the database | Web | Minor | 1 | TypeORM |
| Real-time features using WebSockets | Web | Major | 2 | Socket.IO gateways for chat and the Werewolf game |
| Allow users to interact with other users (chat + profile + friends) | Web | Major | 2 | Basic chat, profile view, friends add/remove/list |
| Implement a complete web-based game | Gaming and UX | Major | 2 | Werewolf, playable end-to-end with clear win/loss conditions |
| Multiplayer game (3+ players) | Gaming and UX | Major | 2 | Werewolf natively supports 3-5 simultaneous players |
| Remote players | Gaming and UX | Major | 2 | Reconnection logic, tested against forced disconnects |
| Game statistics and match history | User Management | Minor | 1 | Requires a game — implemented on top of the Werewolf module |
| **Total** | | | **14** | |

## Individual Contributions

> _TODO: each member should fill in their own section below with what they specifically built, any challenges they ran into, and how they solved them._

- **mawako**: Directed module selection and architecture. Implemented the Werewolf game end-to-end (game rules, WebSocket gateway, frontend UI) together with Claude Code, including several bug fixes found through manual play-testing (robber role mis-attribution, abandoned-game memory leak, missing reconnection logic, stale finished-lobby reuse). Implemented the profile/friends/match-history module, wired real environment-variable configuration (`.env`) for database credentials and the JWT secret, switched password storage to bcrypt hashing, added the Privacy Policy / Terms of Service pages, added request validation (class-validator on the backend, HTML5 constraints on the frontend forms), and set up HTTPS (an nginx reverse proxy with a self-signed certificate, single HTTPS entry point for the frontend, API, and WebSocket traffic).
- **sumedai**: _TODO_
- **kinamura**: _TODO_
- **sninomiy**: _TODO_

