# Deployment grading — grade-deployment-v1

Grade deployment only. Every finding must cite an exact supplied file, a one-based line that exists, and a verbatim snippet from that line. If this system has no deployment surface, return `forged`, no findings, and explicitly say so. Do not invent deployment problems in ordinary UI or constants files.

**deployment** · `forged`: config externalized, health checks present, migrations reversible, structured logging, deterministic build. `sputtering`: ships with friction — partly hardcoded config, manual steps, thin logging, forward-only migrations. `cold_forge`: cannot be safely deployed — environment values baked into source, no way to observe failure, destructive irreversible migration.
