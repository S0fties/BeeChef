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
Open a terminal in the root directory:

```bash
cd backend
python -m venv venv

Windows: venv\Scripts\activate
Mac/Linux: source venv/bin/activate

pip install -r requirements.txt

# (Optional) For development and testing:
pip install -r requirements-dev.txt
pytest

Create your local environment file (it is not committed to git):

* **Windows (CMD):** `copy .env.example .env`
* **Mac/Linux:** `cp .env.example .env`

uvicorn app.main:app --reload
```

### Database Migrations
Database tables are managed with [Alembic](https://alembic.sqlalchemy.org/). Run these from the `backend` directory with the virtual environment activated and the database running:

```bash
alembic upgrade head                          # apply all migrations
alembic current                               # show the current migration
alembic revision --autogenerate -m "message"  # create a migration after changing models
```

Run `alembic upgrade head` after every `git pull` that adds new migration files.

### 3. Frontend Setup
Open a **new** terminal tab:
```bash
cd frontend
npm install

npm run dev
```