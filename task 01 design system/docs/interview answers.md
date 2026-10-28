task 1 interview answers

# Task 1: Design System — Interview Answers

## 1. How would you structure design tokens?

I structured my design tokens in two levels: primitives and semantic tokens.

The primitive tokens contain my main brand colours and their different tones, with their corresponding hex values. The semantic tokens reference these primitive tones rather than containing hardcoded hex values themselves.

For example, a semantic primary colour role references a specific tone in my primary palette. Components use the semantic role instead of selecting primitive colours directly.

I chose this structure to maintain a single source of truth. It also prevents AI from randomly selecting hex codes when generating interface components. Instead, the AI should use the semantic roles defined by my design system.

This makes the system easier to maintain because I can update a primitive value and have the changes flow through the semantic roles that reference it.

## 2. When is a token change breaking?

A token change becomes breaking when it unexpectedly changes the appearance or behaviour of components that depend on it.

For example, if I change a primitive colour's hex value, semantic roles referencing that primitive should receive the updated colour. However, if I hardcode a hex value directly into a semantic role instead of referencing the primitive, that role becomes disconnected from the palette.

When I change the source colour, the disconnected role will not update. This creates inconsistencies across the interface.

A token change can also be breaking when a new value reduces text contrast or makes a component difficult to use.

To prevent this, I need to maintain the primitive-to-semantic references, check the effects of changes, and test the interface after updating tokens.

## 3. How would you support multiple brands and themes?

I would organise separate brand configurations in dedicated folders, with each brand having its own design tokens and brand-specific values.

For themes, I would define corresponding light and dark semantic token mappings. Both themes could share the same underlying component structure while using different values for roles such as the background, surface, text and primary colour.

I always build and test the dark theme alongside the light theme rather than treating it as an afterthought.

This approach would allow the application to switch themes without rewriting every component. Components would continue using semantic roles, while the active theme would determine which primitive values those roles reference.

I would also test contrast and component states in each brand and theme to ensure that the combinations remain usable and consistent.

## 4. Can tokens guarantee accessible contrast?

No. Having design tokens does not automatically guarantee accessible contrast.

Tokens organise and standardise colours, but the chosen colour combinations still need to be checked. A text colour and background colour can both be valid tokens and still have insufficient contrast when used together.

When creating my colour tones and design system, I instruct the AI agent to consider accessibility and check the contrast of intended text and background combinations.

I would also document contrast ratios for my semantic colour roles and verify the actual combinations used in the interface.

The important distinction is that tokens make colour management more consistent, while accessibility testing determines whether those combinations meet the required contrast criteria.

## 5. How do you ensure that colour contrast guidelines are met within a website or application's design?

After building the interface, I run accessibility tests to identify potential issues, including insufficient colour contrast.

I also need to verify contrast during the design-system creation process rather than waiting until the entire interface has been built. This means checking the combinations of text, backgrounds and interactive elements represented by my semantic colour roles.

I would compare the measured contrast ratios against the applicable WCAG requirements and correct any failing combinations.

I would then retest the interface after making changes to ensure the fixes work in the actual components.

This matters because a colour combination that looks good visually is not necessarily accessible. Testing provides evidence rather than relying on appearance alone.

## 6. Can you discuss the differences between WCAG levels A, AA and AAA?

WCAG defines three conformance levels: A, AA and AAA.

**Level A** covers the most basic accessibility requirements. Failing these criteria can create significant barriers for users with disabilities.

**Level AA** includes additional requirements and is a common target for accessible websites. For example, normal text generally needs a contrast ratio of at least 4.5:1, while large text needs at least 3:1.

**Level AAA** has stricter requirements. For example, normal text generally needs a contrast ratio of at least 7:1, while large text needs at least 4.5:1.

The levels build on one another: AA includes the applicable A and AA criteria, while AAA includes the applicable criteria from all three levels.

For my design system, I need to check the applicable contrast requirements and aim for the appropriate conformance level rather than assuming that using consistent tokens makes the interface accessible.

## 7. Discuss the importance of semantic HTML in the context of accessibility.

Semantic HTML uses elements according to their intended meaning and purpose.

For example, I should use a `<button>` for an action, a `<nav>` for navigation and heading elements to establish the structure of a page.

This helps assistive technologies understand the page and allows users to navigate it more effectively. Semantic elements also provide built-in browser behaviours, such as keyboard interaction for native buttons.

If I use generic elements such as `<div>` for everything, I may need to recreate behaviours and accessibility information that native HTML already provides.

In my interfaces, I should therefore combine a consistent design system with appropriate HTML semantics. Design tokens control visual consistency, while semantic HTML helps make the interface understandable and operable.

## 8. How do you handle design handoff to developers using Figma?

I organise the Figma file so that developers can understand and implement the design without guessing.

This includes using clear names for pages, frames, components, variables and styles. I also organise related components and document important design decisions.

Where necessary, I use prototypes to connect screens and demonstrate how interactions and user flows should work.

For the design system, I ensure that colours, typography and other reusable values are represented consistently and can be mapped to the corresponding implementation tokens.

The goal is to reduce ambiguity between the design and the code. A good handoff should help developers understand not only how a screen looks, but also how its components behave and how the design decisions should be implemented.

## 9. Why do AI-generated interfaces tend to look generic, and what specifically do you hand an agent to stop it?

AI-generated interfaces can look generic when the agent has insufficient design direction. Without a reference for the intended visual style or a clear design system, it may rely on familiar layouts and make arbitrary styling choices.

I address this by providing a structured design system rather than allowing the agent to choose colours and styles independently.

My system contains primitive colour tokens, which define the palette, and semantic tokens, which reference those primitives. I also provide typography specifications and instruct the agent to use the defined semantic roles.

I can further improve the results by providing clear component requirements, layout guidance and visual references where available.

This gives the agent constraints to follow and makes its output more consistent with the intended product rather than relying on generic design patterns.

## 10. Your line height for display large is a specific number. Why that number and not one step either side of it? What would you lose with each?

I chose the line height for Display Large to balance readability, visual hierarchy and the amount of space the heading occupies.

My chosen line height is **79.8**. I need to justify it against the font family, font size, weight and the way headings wrap in my interface.

If I reduce the line height by one step, the heading becomes more compact, but multiple lines may feel crowded and become harder to scan.

If I increase it by one step, the heading gains more vertical space, but it can become unnecessarily tall and push other content further down the page.

I chose the value that best balances these trade-offs for my intended typography and layout. I would validate the choice by inspecting actual headings at different widths rather than selecting a number without considering how it renders.

## 11. Point at one place in your own token structure that you would build differently if you started again. Say what you would do instead and what it would cost.

If I started again, I would expand my design system beyond colours and typography to include more component-related design decisions.

For example, I would define reusable tokens or documented styles for button appearance, borders and stroke widths, alongside other recurring interface properties.

This would give the AI agent more complete guidance when generating components instead of leaving it to make independent decisions about these details.

The trade-off is that building and maintaining a more comprehensive system requires additional time. I would also need to decide which values should be global tokens, which should be component-specific tokens, and which should remain local to individual components.

However, the investment would make the system more consistent and reduce the number of styling decisions that the agent has to invent.

## 12. Wrong-answer analysis: Exporting hex values into CSS makes the system a single source of truth.

The missing piece is the relationship between primitive tokens and semantic tokens.

Exporting hex values into a CSS file centralises the values, but that alone does not guarantee that the interface uses them correctly. Components could still contain hardcoded hex values, or semantic roles could contain hardcoded values instead of referencing the primitive palette.

In my system, the original token file should remain the source of truth, and CSS variables should be generated from it. Semantic colour roles should reference primitive colour tokens, and components should consume the semantic roles rather than choosing raw colours.

If these relationships are missing, changing the source palette will not update every part of the interface. Over time, the codebase can accumulate inconsistent colours, making global updates unreliable and maintenance more difficult.

The important point is that a single source of truth requires correct token references throughout the system, not simply a file containing all the hex values.