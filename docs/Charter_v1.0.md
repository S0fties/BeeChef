# Project Charter: BeeChef

## 1. Project Purpose and Objectives
This project aims to develop a web-based smart household management system designed to track food inventory, minimize food waste, and streamline meal planning.
The application allows users to manage shared households with role-based access, update inventory via receipt scanning or manual entry,
and generate dynamic AI-driven recipes based on available ingredients, kitchen appliances, and specific dietary preferences.
Approved meals automatically deduct used ingredients from the inventory and generate smart shopping lists for missing items.

## 2. Stakeholders & Roles
* **Product Owner:** Eren Söylemez
* **Software Engineering Team:**
	* Eren Söylemez			: Product Owner / Developer
    * Erdem Toruk			: Scrum Master / Developer
    * Ahmet Yasir Göktepe	: DevOps Manager / Developer
    * Mehmet Akif Ögrenir	: Test Manager / Developer
    * Celal Gündoğdu 		: UX Manager / Developer
* **GH Repo/Project URL:** {_Do not fill this field in yet; to be filled after charter approval_}

## 3. Project Scope

### Project domain
**Food-Tech & Smart Household Management.** The primary customers and key users include families, shared student apartments, and households with domestic helpers
who want to collaboratively manage kitchen inventory, reduce daily decision fatigue regarding meals, and prevent food waste.

### In-Scope 
* **Web application + PWA integration:** responsive, cross-platform web app optimized for desktop and mobile use, with installable PWA capabilities.
* **Authentication & Household Management:** Creating homes, inviting members, and managing role-based permissions (Home Owner, Family Member, Helper).
* **Inventory Management:** Adding/removing household items (ingredients, appliances) manually and automatically extracting items from uploaded receipt images using Vision AI. 
* **Personal Preferences Section:** Users can manage dietary preferences and restrictions such as veganism, vegetarianism, allergies, and other personal food-related preferences from a dedicated personal preferences tab.
* **Stock Update System:** Reviewing, approving, or rejecting AI-generated recipes, which triggers the automatic deduction of used ingredients from the stock.
* **Smart Shopping List:** Automatically identifying depleted or low-stock items and generating an interactive shopping list.
* **Social Media Feed:** A public timeline for users to share their meals with the outside world.

### Out-of-Scope 
* **Real-time Grocery Market Integration:** Automated direct purchasing or API checkout with delivery services.
* **IoT Hardware Integration:** Connecting directly to smart fridges or physical kitchen sensors.
* **Medical & Caloric Tracking:** Professional medical diet planning, macro/micro nutrient counting, or health data integration.
* **Subscription System:** No paid subscription model, premium tiers, or recurring membership features will be included in this project.
* **Expiration Date Tracking:** Manual or automated monitoring of ingredient shelf life, spoilage predictions, and expiration alerts for items.

## 4. Technology Stack

### 4.1. Backend Stack
- **Framework:** Python (FastAPI)
- **Database:** PostgreSQL
- **Authentication:** JWT (JSON Web Tokens)
- **Media Storage:** Cloudinary
- **DevOps:** Docker

### 4.2. Frontend Stack
- **Framework:** React.js
- **PWA:** Service Workers (Offline support & installability)
- **Styling:** Tailwind CSS

### 4.3. AI Stack
- **Vision API:** Multimodal AI API for receipt text and item extraction
- **Recipe Generation API:** Generative AI API for personalized recipe recommendations
- **Orchestration:** LangChain

## 5. Project Milestones
| Deliverable                       | Deadline          |
|---                                |---                |
| Project Charter                   | 05.10.2026 23:59  |
| Project Plan                      | 19.10.2026 23:59  |
| Requirement Specification Report  | 02.11.2026 23:59  |
| Requirement Analysis Report       | 23.11.2026 23:59  |
| Software Design Report            | 07.12.2026 23:59  |
| Software Test Report              | 21.12.2026 23:59  |
| Codebase                          | 25.12.2026 23:59  |
| Demo                              | 26.12.2026 23:59  |
| Presentation                      | 28.12.2026 23:59  |