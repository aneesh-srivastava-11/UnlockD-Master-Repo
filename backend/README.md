# Unlock'D Backend — Personal Finance API

This is the backend service for the personal finance and expense management application, built with **Node.js, TypeScript, Express, PostgreSQL, and Prisma**.

## Setup & Running
All components are Dockerized and orchestratable using the root `docker-compose.yml` file.

To build and start all containers (database, backend, frontend):
```bash
docker-compose up -d --build
```

The backend server runs on **port 3000** locally and inside its container.

---

## API Endpoints Reference

### Accounts

#### `POST /accounts`
*   **Description:** Creates a new account with an optional starting balance.
*   **Request Body:**
    ```json
    {
      "name": "Jane Doe",
      "balance": 1000.00
    }
    ```
*   **Response (201 Created):**
    ```json
    {
      "id": "e83d8e5c-0cfc-4613-8bfe-300ea903901b",
      "name": "Jane Doe",
      "balance": "1000",
      "createdAt": "2026-07-03T10:49:19.000Z"
    }
    ```

#### `GET /accounts/:id`
*   **Description:** Retrieves details and the current balance of a specific account.
*   **Response (200 OK):**
    ```json
    {
      "id": "e83d8e5c-0cfc-4613-8bfe-300ea903901b",
      "name": "Jane Doe",
      "balance": "1000",
      "createdAt": "2026-07-03T10:49:19.000Z"
    }
    ```

---

### Transactions

#### `POST /transactions`
*   **Description:** Performs an atomic transfer of money from one account to another, secured by an idempotency key and row-level locking.
*   **Request Body:**
    ```json
    {
      "fromAccountId": "e83d8e5c-0cfc-4613-8bfe-300ea903901b",
      "toAccountId": "23fa349a-bd91-4c6e-82d2-8cc700cd1f2f",
      "amount": 250.50,
      "idempotencyKey": "unique-uuid-or-string-12345"
    }
    ```
*   **Response (201 Created for completed or idempotent match):**
    ```json
    {
      "id": "748d1ff5-df4d-4ba6-8c88-294b29bbcf4f",
      "fromAccountId": "e83d8e5c-0cfc-4613-8bfe-300ea903901b",
      "toAccountId": "23fa349a-bd91-4c6e-82d2-8cc700cd1f2f",
      "amount": "250.5",
      "status": "COMPLETED",
      "idempotencyKey": "unique-uuid-or-string-12345",
      "createdAt": "2026-07-03T10:50:00.000Z"
    }
    ```
*   **Response (400 Bad Request if transfer fails, e.g., insufficient funds):**
    ```json
    {
      "error": "Insufficient funds in the sender account",
      "transaction": {
        "id": "cfa5673d-4c3e-436f-8012-bd7bb30987af",
        "fromAccountId": "e83d8e5c-0cfc-4613-8bfe-300ea903901b",
        "toAccountId": "23fa349a-bd91-4c6e-82d2-8cc700cd1f2f",
        "amount": "25000.5",
        "status": "FAILED",
        "idempotencyKey": "unique-uuid-or-string-12346",
        "createdAt": "2026-07-03T10:51:00.000Z"
      }
    }
    ```

#### `GET /transactions/:accountId`
*   **Description:** Returns the complete history of transactions (both sent and received) involving the specified account, sorted by timestamp descending.
*   **Response (200 OK):**
    ```json
    [
      {
        "id": "748d1ff5-df4d-4ba6-8c88-294b29bbcf4f",
        "fromAccountId": "e83d8e5c-0cfc-4613-8bfe-300ea903901b",
        "toAccountId": "23fa349a-bd91-4c6e-82d2-8cc700cd1f2f",
        "amount": "250.5",
        "status": "COMPLETED",
        "idempotencyKey": "unique-uuid-or-string-12345",
        "createdAt": "2026-07-03T10:50:00.000Z"
      }
    ]
    ```
