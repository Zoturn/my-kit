# NestJS rules

- Business logic lives in services; controllers stay thin.
- Validate every DTO (class-validator / pipes). Never trust request bodies.
- Enforce authorization server-side with guards, and check resource ownership in the service layer.
- Use dependency injection; no manual `new Service()`.
