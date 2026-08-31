# v51g Deployment Steps

1. Back up the current GitHub project if desired.
2. Extract `aim-cg-v51g-hotfix.zip`.
3. Replace the current project files with the extracted v51g files.
4. Commit and push to GitHub.
5. Allow the existing GitHub Pages workflow to complete.
6. Refresh/reopen the installed app so the v51g service-worker cache is loaded.

No new Supabase SQL migration is required.

## First check after deployment
1. Sign in as Gary.
2. Open Settings > Trade View.
3. Confirm the header shows Gary and only Gary's assigned schedule is displayed.
4. Open Settings again and confirm People is available there.
5. Confirm there is no standalone People icon in the left navigation.
