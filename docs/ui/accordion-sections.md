# Accordion Sections for Advanced Search Options

The File Content Aggregator application uses Shadcn UI's Accordion component to organize optional/advanced search criteria into collapsible sections. This makes the initial view less overwhelming, especially for simpler searches, while keeping advanced options easily accessible.

## Implementation

The following optional/advanced search criteria are organized into accordion sections:

1. **Exclude Options**
   - Exclude Files (Glob/Regex patterns)
   - Exclude Folders (Wildcard patterns)
   - Folder Exclusion Mode (Contains, Exact, Starts With, Ends With)

2. **Date Options**
   - Modified After (Optional)
   - Modified Before (Optional)

3. **Size Options**
   - Min Size (Optional)
   - Max Size (Optional)

## Benefits

- **Cleaner Interface**: The initial view is less overwhelming, showing only the essential search fields.
- **Better Organization**: Related options are grouped together in logical sections.
- **Improved User Experience**: Users can focus on the most commonly used fields while still having easy access to advanced options when needed.
- **Responsive Design**: The accordion sections work well on both desktop and mobile devices.

## Technical Details

The implementation uses the Shadcn UI Accordion component, which is built on top of Radix UI's Accordion primitive. The component provides a clean, accessible way to create collapsible sections with proper keyboard navigation and ARIA attributes.

### Key Components Used

- `Accordion`: The main container component
- `AccordionItem`: Represents a single collapsible section
- `AccordionTrigger`: The clickable header that toggles the section
- `AccordionContent`: The content that is shown/hidden when the section is toggled

### Example Usage

```tsx
<Accordion type="single" collapsible className="w-full rounded-md border">
  <AccordionItem value="exclude-options" className="border-0">
    <AccordionTrigger className="px-4">
      {t("excludeOptionsLabel")}
    </AccordionTrigger>
    <AccordionContent className="px-4 pt-2">
      {/* Content for the exclude options section */}
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

## Localization

The accordion section labels are localized using the i18next translation system. The following translation keys are used:

- `excludeOptionsLabel`: Label for the exclude options section
- `dateOptionsLabel`: Label for the date options section
- `sizeOptionsLabel`: Label for the size options section

These keys are defined in the `public/locales/[lang]/form.json` files for each supported language.
