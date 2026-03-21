# Test Case: Sort Open Projects

Verify that the sorting functionality in the "Open Projects" modal correctly reorders the list of projects across all four available methods.

## Prerequisites
1.  Run the application in **Mock Mode**: `npm run dev:test`
2.  Open `http://localhost:5173`
3.  Ensure the "Open Projects" modal is accessible (automatically "connected" in mock mode)

## Mock Data Baseline
The mock data (defined in `src/lib/mockData.ts`) provides 6 projects in this default order:
1.  Alpha Release Tracker
2.  Design System Overhaul
3.  Backend Microservices
4.  Mobile App Redesign
5.  Zephyr Cloud Migration
6.  Customer Feedback Board

---

## Test Steps

### 1. Default State Verification
- **Action**: Click the "Open Project" button in the left panel.
- **Expected**: Modal opens. Sort button displays **"Sort by: Recent"**.
- **Order**: Alpha, Design, Backend, Mobile, Zephyr, Customer.

### 2. Name (A → Z) Sorting
- **Action**: Click the sort button; select **"Name (A → Z)"**.
- **Expected**: Button text updates to "Name (A → Z)". Dropdown closes.
- **Order**: Alphabetical:
    1.  Alpha Release Tracker
    2.  Backend Microservices
    3.  Customer Feedback Board
    4.  Design System Overhaul
    5.  Mobile App Redesign
    6.  Zephyr Cloud Migration

### 3. Name (Z → A) Sorting
- **Action**: Click sort; select **"Name (Z → A)"**.
- **Expected**: Button updates to "Name (Z → A)".
- **Order**: Reverse Alphabetical (Zephyr...Alpha).

### 4. Oldest Sorting
- **Action**: Click sort; select **"Oldest"**.
- **Expected**: Button updates to "Oldest".
- **Order**: Reverse Chronological (Customer...Alpha).

### 5. Recent (Restoration)
- **Action**: Click sort; select **"Recent"**.
- **Expected**: Button updates to "Recent".
- **Order**: Original Chronological (Alpha...Customer).

### 6. Interaction / UI Check
- **Action**: Open sort dropdown, then click anywhere else on the screen.
- **Expected**: Dropdown closes automatically.
- **Action**: Verify the current sort method has a **checkmark** icon next to it in the dropdown.
