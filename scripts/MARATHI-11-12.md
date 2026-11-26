# Class 11/12 Marathi syllabus (API key ki zaroorat NAHI)

18 files x 100 = 1800 questions ka Marathi already bana hua hai:
  scripts/translations-11-12/*.json            (translation source)
  scripts/seed-data/syllabus-9-12/11th Marathi/ , 12th Marathi/   (ready Excel, seed isse padhta hai)

Run (project root, PowerShell):
1. npm run seed:marathi:dry     -> class 11/12 tests me "+N Marathi questions" dikhna chahiye
2. npm run seed:marathi         -> sirf naye Marathi questions add, kuch delete nahi
3. npm run check:languages      -> verify
4. Deploy + restart

Agar Excel dobara banani ho: npx tsx scripts/translate-excel.ts --no-api --force
