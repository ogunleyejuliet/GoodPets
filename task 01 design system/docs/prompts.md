##Prompt 1
Using the material design 3 guide, give me the neutral and the neutral variant key colors for this primary key color 037171, using the monochromatic combination method

##Prompt 2
Here are my key colors : 

Primary Key Color : 037171

Secondary key Color : f18f01

Tertiary Key Color : 8bd7d2

Neutral key Color : 757d7d

Neutral Variant Key Color : 707f7f

Error Key Color : de3730

Warning Key Color : FFA500 

Success color : 2e9e4f

I want you to go and read the material design 3 documentation ([https://m3.material.io/](https://m3.material.io/))  on colors. Read it 3 times and kill every assumption you have about the material design system. deal with facts only from the documentation

use what you have learnt from the documentation to create color palettes for each of the key color I have listed above

Do not forget, each color palette will contain 14 colors and if there is a need for any color palette to contain more than 14 colors , explain why and create the extra color under your main result


##Prompt 3
keep the primary color  as the primary40 color in the color palette of the primary key color. What I mean is simple. Let the primary color override any choice that could become the primary color in the color system.

##prompt 4
Write a Javascript script that you will use to convert the design system in @(ref the tokens.json file) to CSS variables.
Take note of the primitive colors in the system and the color roles. Using standard system practise, remember that the color roles are what will be used directly on the UI and the primitive will not be used directly on the UI.
Use CSS variables and ensure that this design system remains the source of truth for UI implementation 

##prompt 5

I want to convert my existing `design tokens.json` into CSS variables and integrate them into my current project.

**Use `design tokens.json` as the single source of truth.**

### Instructions

1. Inspect the actual JSON file and the existing project structure before making changes.

2. Create a reusable JavaScript script named `tokens-to-css.js` that reads the JSON and generates a CSS file named `tokens.css`. Do not hardcode token values in the script.

3. Preserve the distinction between:
   - **Primitive tokens:** raw colors and tonal palettes, exported as `--primitive-*` variables.
   - **Semantic color roles:** UI-facing colors, exported as `--color-*` variables. Components must use these semantic variables rather than primitive colors directly.

4. Convert all supported token categories present in the JSON, including typography, spacing, sizing, borders, radii, shadows, and effects. Preserve the actual values, units, names, and relationships represented in the source.

5. Resolve token references and aliases correctly. Ensure generated semantic variables reference primitive variables when appropriate, without changing the intended token values.

6. Preserve existing light and dark color-role definitions if they exist in the JSON. Do not invent missing tokens or theme values.

7. Save the JavaScript converter and generated CSS in appropriate locations within the existing project. Import the generated CSS into the application's actual styling entry point.

8. Update existing UI styles to consume the generated semantic variables where necessary. Avoid unrelated redesigns and do not introduce a new styling framework.

9. Run the converter and validate the output. Check for missing variables, unresolved references, incorrect values, invalid CSS, and build errors.

10. Ensure the CSS can be regenerated whenever `design tokens.json` changes. Do not manually maintain duplicate token values in component styles.

### Required workflow

`design tokens.json` → `tokens-to-css.js` → `tokens.css` → UI components.

### Deliverables

Make the changes directly in my existing project. Provide the JavaScript converter, the complete generated CSS file, and the integration changes. Report what you actually verified.

Do not create separate documentation or divergence files. Do not modify the source JSON or invent values to fill gaps.

##prompt 6

Build a GoodPets daycare subscription landing page that promotes a discount on daycare monthyly subscriptions.

Requirements:

Create a polished, responsive landing page with a hero section, promotional offer, subscription benefits, how-it-works section, and call-to-action.Do not integrate the design system yet. I need to inspect this first version

##prompt 7

Apply my existing design system to the existing GoodPets daycare subscription landing page 
1. Inspect before making changes

Inspect the existing landing page and identify its HTML, CSS, JavaScript, and related files.

Inspect my actual design-system token JSON, semantic colour roles, CSS-variable conversion, and generated CSS.

Use the design system that already exists in this project. Do not invent a new palette, replace my tokens, or create a separate design system.

2. Apply the design system

Replace hardcoded interface colours with the appropriate semantic CSS variables generated from my design tokens.

Use semantic roles such as primary, on-primary, secondary, surface, background, and their corresponding roles where appropriate. Follow the names and structure that actually exist in my system; do not assume token names that are not present.

Do not use primitive palette tokens or raw hex values directly in interface styles when a semantic role is available.

Apply the existing typography tokens, spacing, border-radius, elevation, and other relevant design tokens wherever they are defined.

Preserve the existing GoodPets content, page structure, imagery, functionality, and responsive behaviour. Improve styling to match the design system without unnecessarily redesigning the page.

Maintain readable contrast, visible interactive states, and accessibility.

3. Verify the implementation

Confirm that the generated CSS variables are correctly imported and used by the landing page.

Search the relevant interface source files for remaining hardcoded colour values.

Fix unintended hardcoded interface colours where appropriate. Do not alter legitimate values in source token files, generated token CSS, documentation, or evidence files just to make the search return zero.

Run the page and check that the changes render correctly. Do not claim that something has been tested unless you actually tested it.

4. Protect the existing assignment work

Do not overwrite my original before screenshot.

Do not fabricate, edit, or generate screenshots as substitutes for actual application screenshots.

Do not modify my existing token JSON, conversion script, or assignment evidence unnecessarily.

Leave the updated landing page running or ready to run so I can capture the actual after screenshot at task-01-design-system/evidence/10-screen-with-system.png.

5. Report back

When finished, tell me:

Which files you changed.

Which existing semantic colour and typography tokens you applied.

What verification you performed.

Any remaining hardcoded interface colours and why they remain.

The local URL or exact steps I need to open the updated landing page and capture the screenshot.

Implement the changes in the existing project, not just describe a plan.