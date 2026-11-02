# Task 3 — Interview Answers

## 1. Why is client-side validation not enough?

Client-side validation is not enough because it runs in the user's browser, which the user does not control. Someone can disable JavaScript, modify the page, change form values through DevTools, or bypass the interface completely by sending an HTTP request directly to the server.

Client-side validation improves the user experience. It helps users notice mistakes before submitting, provides immediate feedback, and reduces unnecessary requests. However, it cannot be trusted as a security boundary.

The server must independently validate every piece of data it receives before processing or storing it. It must also enforce authentication, authorization, business rules, and other security controls.

I tested this distinction in Good Pets by sending requests directly to the signup endpoint instead of using the form. The server rejected a one-character name with HTTP 400, but accepted a request containing a password made entirely of spaces with HTTP 201.

That test demonstrated why browser validation cannot prove that an endpoint is secure. It also revealed a weakness in my server-side password validation that needs to be corrected. My conclusion is that frontend validation is for usability; server-side validation is mandatory for data integrity and security.

## 2. What security checks belong in the frontend, and what must the server enforce regardless?

The frontend should help users submit correct information. Examples include checking required fields, showing email-format errors, displaying password requirements, validating confirmation fields, and explaining when terms have not been accepted.

These checks make the form easier to use, but they are not authoritative. A user can bypass or manipulate them.

The server must repeat all important validation. It should verify that required values exist, enforce length and format limits, normalize values consistently, check password requirements, and reject mismatched confirmation values where applicable. It must also check whether an email is already registered.

Security checks must also happen on the server. These include authentication, authorization, rate limiting, secure password hashing, session management, and enforcing business rules. For example, hiding an administrative action in the frontend does not stop an ordinary user from calling the corresponding API directly.

In Good Pets, the signup endpoint performs server-side name and email validation, checks password length and confirmation, hashes passwords using Argon2id, and creates the user record. My direct-request test also exposed that checking password length without trimming whitespace allows a whitespace-only password through. That is a server-side validation defect, not something the frontend should be expected to solve.

## 3. The user interface hides the delete button for non-administrators. Is that enough?

No. Hiding the delete button is only a user-interface decision. It does not enforce authorization.

A user can inspect the page, use browser developer tools, discover the API endpoint, or send a request directly. If the server only relies on the button being hidden, an ordinary user may still be able to perform the deletion.

The server must verify the user's identity and permissions every time a protected operation is requested. It should establish who is making the request, retrieve or verify their role, and confirm that the role is allowed to perform the requested action. If the user is not authorized, the server should reject the request, normally with HTTP 403 for an authenticated user without permission.

For Good Pets, an administrative action should only be available to an authenticated manager with the appropriate permission. The server must enforce that rule even if someone manually constructs the request.

The frontend can still hide controls that the user cannot use because that makes the interface clearer. However, the server remains the security boundary. I would test this by signing in as an ordinary customer and sending a direct request to the administrative endpoint. The expected result is that the server refuses the operation and makes no change to the data.

## 4. What is the difference between validation, encoding and sanitisation?

Validation checks whether data meets the requirements for a particular purpose. For example, a signup endpoint can check that an email has an acceptable structure, a name is within the allowed length, and a password meets the minimum requirements.

Encoding changes how data is represented so that it is interpreted safely in a particular context. For example, HTML output encoding converts characters such as angle brackets into representations that the browser displays as text instead of interpreting as markup.

Sanitisation removes or transforms content considered unsafe according to a defined policy. It is particularly relevant when an application intentionally accepts content such as user-generated HTML and needs to restrict what markup is allowed.

These concepts are related, but they are not interchangeable. Validation does not automatically make a value safe to display. Sanitising everything in the browser does not protect the server because a request can bypass the browser entirely. Encoding should be applied for the context in which data is used, rather than assuming one transformation is safe everywhere.

In Good Pets, I validate the name and email on the server and normalize values such as email addresses before storage. When displaying user-provided data, I should rely on the framework's safe output handling and apply context-appropriate encoding rather than treating frontend sanitisation as a security solution.

## 5. Why should you validate route parameters and query strings, not just the body?

An HTTP request contains more than a body. Route parameters and query strings can influence which records an application retrieves, updates, or deletes. If these values are not validated, an attacker may manipulate them to access unintended records, trigger errors, or bypass assumptions made by the application.

For example, a route such as `/api/bookings/[id]` receives the booking identifier through the URL. The server should validate that the identifier has the expected format and then check that the authenticated user is allowed to access that booking. A valid identifier does not automatically mean the user owns the record.

Query strings also need validation. A parameter such as `?page=abc` should not be blindly converted into a database query or pagination value. The application should enforce expected types, ranges, and allowed values.

In Good Pets, booking identifiers and query parameters can affect access to customer and pet records. The server should validate these inputs and enforce ownership or manager permissions before returning or changing data.

The important distinction is that validation checks whether the input is structurally acceptable, while authorization checks whether the user is allowed to perform the requested operation. Both are necessary.

## 6. Explain what a single-page application is, and how you make one discoverable by search engines.

A single-page application, or SPA, is an application where navigation between views can happen by updating the content on the page rather than requesting an entirely new HTML document for every interaction. The application can use client-side state and routing to switch between views.

In Good Pets, the authentication experience consolidates login, signup, and password reset into one route. The active mode is represented in the URL query parameter, and the page changes the displayed form based on that state. This avoids maintaining three separate authentication pages while still allowing each mode to have a shareable URL state.

SPAs can be difficult for search engines if important content is only rendered after JavaScript runs. To improve discoverability, I would use server-side rendering or static generation for public content, provide meaningful page titles and descriptions, use semantic HTML, and ensure important links have crawlable URLs.

Good Pets uses Next.js, which supports server rendering and metadata through the App Router. The public marketing page can expose its content and metadata to search engines, while private authentication and booking pages do not need the same search visibility.

A single-page interaction pattern does not mean the entire website must be one route or that every page should be client-rendered.

## 7. What are the advantages and disadvantages of a single-page application against a multi-page application?

A single-page application can make interactions feel faster because it can update only the relevant part of the interface instead of requesting a complete new document. It can also preserve state between views and provide a more continuous experience.

However, it introduces complexity. Client-side routing and state need to be managed correctly, browser history must work, and accessibility needs attention when content changes without a full page navigation. Search-engine discoverability can also require additional care if important content depends on JavaScript rendering.

A multi-page application has a simpler navigation model in many cases. Each route can load a new document, which makes browser navigation and some accessibility expectations more straightforward. However, repeated page loads can make interactions feel less continuous, and shared state may need to be reloaded or persisted.

For Good Pets, I used a consolidated authentication route because login, signup, and reset are closely related tasks. The URL query parameter identifies the active mode. This reduces duplicated page structure while preserving distinct URLs for each form state.

I would not automatically turn the whole application into a SPA. Public marketing pages, booking pages, and account experiences have different needs. I would choose the architecture that best supports the user's journey, performance, accessibility, and maintainability.

## 8. Can you explain the four principles of the Web Content Accessibility Guidelines, with examples from your own work?

The four WCAG principles are Perceivable, Operable, Understandable, and Robust, often abbreviated as POUR.

Perceivable means users must be able to receive the information. Colour should not be the only way errors are communicated. In my Good Pets authentication form, errors need readable text and an additional caution indicator rather than relying only on a red border.

Operable means users must be able to interact with the interface. Controls should work with a keyboard, focus should be visible, and users should not become trapped. I checked the authentication mode controls and interactive form elements for keyboard access and focus behaviour.

Understandable means information and interactions should be clear and predictable. Form labels should explain what is expected, validation messages should identify the problem, and errors should help users correct it.

Robust means content should work with different browsers and assistive technologies. Semantic HTML, correct labels, accessible names, and relationships such as `aria-describedby` help assistive technologies interpret the interface.

My accessibility work included reviewing inline errors, field descriptions, mode controls, and screen-reader announcements. I also recorded before-and-after screen-reader transcripts. I would still treat accessibility as an ongoing testing process rather than assuming that adding ARIA attributes automatically makes a page accessible.

## 9. Discuss the importance of semantic HTML in the context of accessibility.

Semantic HTML gives elements meaning through their native purpose. A button is a button, a link is a link, a heading is a heading, and a form field has an associated label.

This matters because browsers and assistive technologies already understand the behaviour and meaning of these elements. A real button supports keyboard activation and exposes its role to screen readers. A real link communicates navigation. A properly labelled input gives users a meaningful name for the field.

If developers use generic elements such as `div` for everything and recreate behaviour manually, they must also recreate keyboard support, focus behaviour, accessible names, and other expected interactions. Missing any of these can make the interface difficult or impossible to use.

In Good Pets, semantic form labels and controls help screen-reader users understand the authentication fields. Error messages also need to be programmatically associated with the relevant input, not merely displayed visually nearby. Mode-switching controls should expose their purpose and state.

ARIA can improve accessibility when native HTML does not provide the required information, but it should not replace appropriate semantic elements. My approach is to use native HTML first, then add ARIA only where it communicates additional information that the native element does not already provide.

## 10. Tell me about a time when you disagreed with what a customer wanted to build.

I have not yet had a verified real-world customer disagreement that I can honestly present as a completed professional engagement. I would rather be clear about that than invent a customer story.

The way I would approach such a situation is to first understand the outcome the customer is trying to achieve. I would ask what problem the requested feature solves, who needs it, and what evidence supports the proposed solution. Sometimes the requested feature is a reasonable response to a real problem, but it may not be the simplest or safest way to solve it.

For example, in product design work on Good Pets, I considered how much choice customers should face before booking. My approach was to keep the customer journey focused on the decisions they actually need to make, while preserving information required for a correct booking. That is a product-design decision, not a claim that I disagreed with an actual paying customer.

If a customer requested something that created usability, security, or maintenance problems, I would explain the trade-offs in plain language, offer an alternative, and agree on how we would evaluate it. I would not dismiss their request simply because I preferred a different implementation.

## 11. How would you explain to a non-technical executive why their AI implementation is not performing as expected?

I would avoid starting with technical jargon. I would explain that an AI assistant's answer depends on both the information it receives and how it uses that information. If the system retrieves the wrong documents, it may produce a confident but incorrect answer. If it retrieves the right information but interprets it incorrectly, the generation step may be responsible.

For a Good Pets-style assistant, I would first check whether the knowledge base contains current, approved information about services, prices, policies, and procedures. I would then inspect what information was retrieved for the failed question and compare it with the final answer.

I would collect examples of incorrect answers and group them by cause. I would measure whether the system retrieves relevant information, whether answers are supported by that information, and whether it correctly refuses questions outside its approved knowledge.

I would explain the findings in terms of customer impact: incorrect prices can cause disputes, outdated policies can mislead customers, and unreliable availability information can lead to failed bookings.

I would recommend fixing the specific failure rather than immediately changing the AI model. Better source content, retrieval settings, clearer instructions, or a more appropriate escalation path may solve the problem more effectively.

## 12. One of your validation rules wrongly blocks a category of legitimate user. Name the rule, name the users, and defend the trade-off or say you got it wrong.

One rule in my Good Pets signup validation requires a full name containing at least two names. The server rejects a name shorter than two characters, and the validation message asks for a full name.

This can wrongly block legitimate users who have a single legal name, use a mononym, or have naming conventions that do not fit the assumption that every person has a first name and surname. It may also create difficulties for users whose official identity documents contain only one name.

The original intention was to prevent meaningless one-character names and automated junk registrations. However, requiring two names is not a reliable way to identify a genuine person. A bot can submit two invented words, while a legitimate person can have one name.

I would not defend this as a perfect rule. I would review whether Good Pets genuinely needs separate first and last names. If it only needs a display name, a more inclusive rule would accept a reasonable single name while rejecting empty values, whitespace-only values, and values outside sensible length limits.

This is a trade-off between reducing low-quality registrations and not excluding legitimate customers. The rule should be based on the actual data requirement, not an assumption about how everyone is named.

## 13. You sent a request directly to your own endpoint. Say exactly what happened and what it tells you about the eight rules you spent two days writing.

I sent direct HTTP POST requests to the Good Pets signup endpoint at `/api/auth/signup`, bypassing the browser form.

In the first test, I submitted a one-character name and a password made of eight spaces. The server returned HTTP 400 with the error that the full name must be between two and one hundred characters. This showed that the server enforced the name-length rule even when the frontend was bypassed.

In the second test, I submitted a valid-looking name and email address, with both password fields containing eight spaces. The server returned HTTP 201 and a successful user response. A test account was created.

This showed that the server accepted a whitespace-only password because the password check used its raw length rather than rejecting whitespace-only content. The test therefore proved that some validation rules were enforced server-side, but it also exposed a defect.

It would be inaccurate to claim that all eight rules were secure simply because the form behaved correctly. Each rule must be tested against the endpoint directly. The password issue needs a server-side correction and a regression test in the next task.

## 14. Wrong-answer analysis: A candidate says, “I use strong client-side validation with regex on every field, disable the submit button until everything is valid, and sanitise all inputs in the browser before sending them.” What is wrong with this answer?

The answer confuses user experience with security. Client-side validation is useful because it gives immediate feedback, but it can be bypassed. An attacker can disable JavaScript, modify the page, or send a request directly to the endpoint. Regex checks in the browser do not protect the database.

Using regex on every field is also not automatically good validation. Some formats are more complex than a simple pattern can safely describe, and overly strict patterns can reject legitimate users. Validation rules should reflect actual business requirements and be enforced by the server.

Disabling the submit button until everything is valid can create accessibility problems. A user may not understand why the button is unavailable, and keyboard or screen-reader users may have difficulty discovering what needs correcting. A visible button with clear validation feedback can be more understandable.

Browser sanitisation is not a security boundary either. It can be bypassed, and sanitisation is context-dependent. The server must validate incoming data, enforce authorization and business rules, and safely encode output for the context in which it is displayed.

The better approach is accessible client-side feedback combined with independent server-side validation and security controls. My direct-request test demonstrated why this matters: the server accepted a whitespace-only password despite the form's validation experience.