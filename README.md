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

## Quick Start

Clone the repository:
```bash
git clone https://github.com/S0fties/BeeChef.git
cd BeeChef
```

### 1. Backend Setup
Open a terminal in the root directory:

```bash
cd backend
python -m venv venv

Windows: venv\Scripts\activate
Mac/Linux: source venv/bin/activate

pip install -r requirements.txt

uvicorn app.main:app --reload
```

### 2. Frontend Setup
Open a **new** terminal tab:
```bash
cd frontend
npm install

npm run dev
```