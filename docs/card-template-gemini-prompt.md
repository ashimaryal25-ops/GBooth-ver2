# Card Template Gemini Review Prompt

Use this prompt with one card background image at a time.

```text
You are evaluating one trading-card background for a campus photo booth app.

Look only at the attached card background image. Describe what kind of person this card visually fits.

Return compact JSON only:
{
  "visualSummary": "1 sentence describing the design",
  "bestFitPerson": "1 sentence describing the personality/user type it fits",
  "strongTraits": ["3-8 trait words"],
  "matchingKeywords": ["8-20 search words or phrases a student might type about themselves"],
  "avoidFor": "1 sentence describing who this card should not be selected for"
}

Do not identify sensitive attributes from people. Focus on style, energy, hobbies, roles, behavior, and self-description clues.
```

Current app template ids:

- `athletic-blue`
- `empathy-pastel`
- `leadership-red`
- `pride-rainbow`
- `creative-magenta`
- `gold-star`
- `tech-growth-green`
