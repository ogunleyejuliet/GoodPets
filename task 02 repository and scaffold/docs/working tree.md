# Working-Tree Drawing: From Local Changes to Production

**Project:** Good Pets  
**Date:** 29 October 2026

## 1. Purpose of the Drawing

The drawing illustrates how changes move from a developer's local computer to a remote GitHub repository and eventually to a deployed application. It also shows how feature branches allow different pieces of work to be developed separately before they are merged into the main branch.

The workflow helps explain how code is tracked, reviewed, integrated, and released while reducing the risk of introducing errors into the application used by customers.

## 2. What Each Part Represents

### Local Folder

The local folder is the project directory on my computer. It contains the application source code, configuration files, documentation, and other project files. Changes are made here before they are recorded in Git.

### Local Git Repository

The local Git repository tracks the project's history. After initializing Git, I can stage changes and create commits. A commit records a snapshot of the staged changes, allowing me to inspect the history and return to an earlier version when necessary.

### GitHub Repository

The GitHub repository is the remote copy of the project. Pushing sends local commits to GitHub, making them available for collaboration, review, and backup.

The local and remote repositories can contain different commits until changes are pushed or pulled.

### Main Branch

The `main` branch represents the primary line of development. Changes that have been reviewed and accepted are integrated into this branch.

It should remain stable enough for the team to use as the foundation for further development and releases.

### Feature Branches

The drawing includes two feature branches:

- `reschedule-booking`: for implementing or improving booking rescheduling.
- `bookings`: for implementing or improving booking functionality.

Each feature branch isolates a piece of work from the main branch. Developers can make commits and test their changes without immediately changing the main branch.

### Commits and Pushes

A commit records changes in the local repository. A push transfers commits to the remote repository on GitHub.

Committing does not automatically publish changes to GitHub, and pushing does not automatically mean the application has been deployed.

### Merge

A merge integrates changes from one branch into another. In the drawing, the feature branches merge into the main branch after their work has been completed and reviewed.

In a collaborative workflow, this normally happens through a pull request. A pull request allows the proposed changes to be inspected and tested before they are accepted.

### Deployment

Deployment makes a particular version of the application available through a hosting platform. The drawing shows changes reaching deployment after they have been merged into the main branch and pushed to GitHub.

For Good Pets, the exact deployment behavior depends on the hosting configuration. If automatic deployment is configured for `main`, a successful push of a merged change can trigger a new deployment.

## 3. How Changes Move Through the Workflow

The intended workflow is:

1. Make a change in the local project folder.
2. Stage the relevant files and create a commit.
3. Create or switch to a feature branch for the work.
4. Push the feature branch to GitHub.
5. Open a pull request targeting `main`.
6. Review the changes and run the required checks.
7. Merge the pull request after it has been approved.
8. Push or confirm that the updated `main` branch is on GitHub.
9. Deploy the updated application through the configured deployment process.
10. Verify that the deployed application behaves as expected.

This workflow separates writing code, recording changes, sharing work, reviewing changes, and releasing the application. Each stage has a distinct purpose.

## 4. Why Feature Branches and Pull Requests Are Useful

Feature branches allow work on different features to progress independently. For example, booking rescheduling can be developed separately from general booking functionality.

This reduces interference between unfinished changes and makes it easier to identify which commits belong to a particular task.

Pull requests provide an explicit review point before code enters the main branch. They allow another developer to inspect the changes, ask questions, identify defects, and check that the proposed implementation meets the requirements.

They also create a record of why a change was introduced and how it was reviewed.

## 5. Where Users Can First See a Change

Users can first see a change when the version containing that change has been deployed to an environment they can access.

Pushing a feature branch to GitHub does not, by itself, mean that ordinary users can see the change. If a preview deployment is configured, reviewers may be able to see the feature before it is merged. Otherwise, users generally see it after the change has been merged into the release branch and deployed.

For Good Pets, this depends on the deployment platform and its configuration. A local change is visible only in the local development environment until it is published to an accessible environment.

## 6. Why Mistakes in Shared History or Production Need Careful Handling

Mistakes in a local working directory can often be corrected before they are committed or shared. Once commits have been pushed and other people have based their work on them, changing history can affect those collaborators.

Rewriting shared history or force-pushing can remove or replace commits that other developers depend on. Before taking such action, the team should inspect the affected branches, communicate with collaborators, and agree on a safe recovery procedure.

Production mistakes require additional care because they can affect real users, bookings, and data. The team should assess the impact, preserve relevant logs, and use a tested fix or rollback procedure. Database changes must be handled carefully to avoid losing or corrupting customer records.

A successful rollback of application code does not necessarily reverse database changes. Recovery procedures should therefore account for both the application and its data.


