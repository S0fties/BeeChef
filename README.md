# BeeChef
BeeChef is an AI-powered smart kitchen application that helps households track inventory and reduce food waste. It features automated stock updates and generative AI for personalized recipe recommendations.

## Team Members

| Name | Management Role | Development Role |
| :--- | :--- | :--- |
| Eren Söylemez | Product Owner | Developer |
| Erdem Toruk | Scrum Master | Developer |
| Ahmet Yasir Göktepe | DevOps Manager | Developer |
| Mehmet Akif Ögrenir | Test Manager | Developer |
| Celal Gündoğdu | UX Manager | Developer |

## Prerequisites

Before running the project, make sure you have the following installed:
* **Node.js:** Download and install the latest LTS version from [nodejs.org](https://nodejs.org/en/download).
* **Python:** Version 3.8 or higher.
* **Docker Desktop:** Required for the PostgreSQL database. Make sure it is running. Download from [docker.com](https://www.docker.com/products/docker-desktop/).

## Quick Start

Clone the repository:
```bash
git clone https://github.com/S0fties/BeeChef.git
cd BeeChef
```

### 1. Database Setup
From the project root directory, start PostgreSQL with Docker:
```bash
docker compose up -d
```

Check that the container is running and healthy:
```bash
docker compose ps
```

### 2. Backend Setup
From the repository root, create and activate a Python virtual environment:

```bash
cd backend
python -m venv venv
```

Activate the virtual environment:

* **Windows:** `venv\Scripts\activate`
* **Mac/Linux:** `source venv/bin/activate`

Install the backend and test dependencies:

```bash
python -m pip install -r requirements-dev.txt
```

Create your local environment file from the example:

* **Windows:** `copy .env.example .env`
* **Mac/Linux:** `cp .env.example .env`

Edit `backend/.env` and set both database URLs. With the default Docker Compose
credentials, use:

```bash
DATABASE_URL=postgresql+psycopg://beechef:ronaldo@localhost:5432/beechef_db
TEST_DATABASE_URL=postgresql+psycopg://beechef:ronaldo@localhost:5432/beechef_db_test
```

Keep the two URLs pointed at different databases. The application and Alembic use
`DATABASE_URL`; pytest uses only `TEST_DATABASE_URL`.

### Database Migrations
Database tables are managed with [Alembic](https://alembic.sqlalchemy.org/). Run these from the `backend` directory with the virtual environment activated and the database running:

```bash
alembic upgrade head                          # apply all migrations
alembic current                               # show the current migration
alembic revision --autogenerate -m "message"  # create a migration after changing models
```

Run `alembic upgrade head` after every `git pull` that adds new migration files.

### Database Seeding
Populate the shared catalog with standard ingredients and appliances from `backend/data/items_catalog.csv`:

```bash
python -m app.db.seed
```

This command is safe to run multiple times (*idempotent*). Run it after `alembic upgrade head` on a fresh database or whenever seed catalog files are updated.

### Backend Tests
From the `backend` directory, with the virtual environment activated and PostgreSQL
running, run the complete test suite:

```bash
python -m pytest
```

Pytest runs all tests under `backend/tests` against `TEST_DATABASE_URL` and resets
its tables before each run; each test's data is rolled back afterward. Set it to a
separate database locally. In CI, `DATABASE_URL` and `TEST_DATABASE_URL` both point
to the same disposable test database.

### Run the Backend
From the `backend` directory, with the virtual environment activated:

```bash
uvicorn app.main:app --reload
```

### 3. Frontend Setup
Open a **new** terminal tab:
```bash
cd frontend
npm install

npm run dev
```