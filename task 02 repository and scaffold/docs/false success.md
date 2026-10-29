# False Success: Database Write Verification

## 1. What the user saw

During the deliberate database-failure test, the Good Pets signup form displayed an error indicating that it could not connect to the database. The form did not proceed as though registration had succeeded.

## 2. What actually happened

The database connection was deliberately made unavailable by changing the hostname used by the application. The signup API returned HTTP 500.

The server logs recorded that Prisma could not reach the database server at the invalid hostname. Therefore, the attempted registration failed. The database should be checked to confirm that no record was created for the test account.

## 3. How a demo reviewer could be fooled

A reviewer could be misled if an application displays a success message or advances to the next step before confirming that the server successfully persisted the data. A successful-looking interface does not, by itself, prove that a database write occurred.

## 4. How Good Pets prevents false success

The signup form sends a POST request to `/api/auth/signup`. It advances only when the API returns HTTP 201 with `success: true`. If the request fails, the form displays an error rather than reporting successful registration.

## 5. Evidence

- Successful signup logs: `evidence/11-write-succeeded-logs.txt`
- Database rows screenshot: `evidence/12-database-rows.png`
- Failed signup logs: `evidence/13-write-failed-logs.txt`
