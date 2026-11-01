# Git Rollback

## 1. Background

During development of the Good Pets landing page, I added a testimonial section to display sample customer feedback.

After reviewing the page, I decided that I did not want the testimonial section in the current landing-page design. I therefore chose to reverse the change as a practical exercise in Git rollback.

## 2. Change selected for rollback

The testimonial section was introduced in the following commit:

- **Commit ID:** `e37158e`
- **Commit message:** `added testimonial to landing page`
- **File modified:** `src/app/LandingContent.tsx`

The commit added 88 lines and removed one line.

A later commit, `53b5d1d`, fixed a CSS issue by modifying `.vscode/settings.json`. Since it did not modify the testimonial component, it was preserved.

## 3. Rollback method

I used `git revert` to reverse the testimonial commit:

```powershell
git revert e37158e
```

Git created a new commit:

```text
0eda991 Revert "added testimonial to landing page"
```

The revert removed the testimonial section while preserving the original commit in the repository history.

## 4. Why I used git revert instead of git reset

`git revert` creates a new commit that reverses the changes introduced by an earlier commit.

This is appropriate when working with shared Git history because it does not remove or rewrite the original commit. Other developers can still see what was introduced and how it was subsequently reversed.

By contrast, `git reset` moves the current branch reference to an earlier commit. Depending on the reset option, it can also change the working directory and staging area. Rewriting already-shared history can cause problems when collaborating with others.

Using `git revert` allowed me to undo the unwanted change while preserving the existing history.

## 5. Why specifying a commit ID is safer

A commit ID identifies one specific change in Git history.

Describing a rollback vaguely, such as asking Git to undo the testimonial work, could lead to confusion if several commits affect the same page or feature.

Using the exact commit ID `e37158e` made it clear which change I intended to reverse. It also made the operation easier to verify and document.

## 6. Verification

After the rollback:

- The testimonial section was removed from the Good Pets landing page.
- The original testimonial commit remained in Git history.
- The new revert commit appeared as `0eda991`.
- The later CSS commit `53b5d1d` remained in history.
- The working tree was clean.
- The local `main` branch was one commit ahead of `origin/main` because the revert had not yet been pushed.

The result was recorded in `evidence/17-commit-list-and-rollback.txt`.

## 7. Conclusion

This exercise demonstrated how to reverse an unwanted committed change without deleting the original commit or rewriting Git history.

I used the exact commit ID to identify the change, executed `git revert`, and verified that the testimonial section was removed. The rollback is now represented by its own commit, making the development history traceable.