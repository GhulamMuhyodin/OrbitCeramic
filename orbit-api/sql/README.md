# Phase 1 schema + seed

1. Import schema from the Angular repo:

```bat
type ..\public\data\schema-phase1.sql | C:\xampp\mysql\bin\mysql.exe -u root orbit_ceramic
```

2. Import sample content:

```bat
type seed-phase1.sql | C:\xampp\mysql\bin\mysql.exe -u root orbit_ceramic
```

Then open: http://localhost:8080/api/v1/bootstrap
