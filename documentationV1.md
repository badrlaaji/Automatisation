
Start
   ↓
Create Account
   ↓
Send Welcome Email
   ↓
End
```

## Architecture du projet

src/

engine/
    WorkflowEngine.ts

entities/
    User.ts

repositories/
    UserRepository.ts

services/
    UserService.ts
    EmailService.ts

handlers/
    RegisterHandler.ts
    SendEmailHandler.ts

workflows/
    EX1.json

main.ts
```

### workflow (EX1.json)

Le fichier JSON décrit le processus métier.

Exemple :

```text
Que doit faire le système ?
```

Il contient :

* les étapes du workflow ;
* les transitions ;
* le point de départ ;
* le point de fin.

---

###  WorkflowEngine

Le WorkflowEngine constitue le cœur du système.

Ses responsabilités :

* charger le workflow ;
* construire le graphe d'exécution ;
* trouver le nœud de départ ;
* exécuter chaque étape ;
* déterminer l'étape suivante ;
* arrêter le processus.

Pseudo-algorithme :

```text
charger workflow
    ↓
trouver start
    ↓
executer étape
    ↓
chercher next
    ↓
executer étape suivante
    ↓
...
    ↓
end
```

---

###Entities

Les entités représentent les objets métier.

Pour EX1 :

```text
User
```

Exemple :

```text
id
name
email
```

---

###Repositories

Les repositories assurent le stockage des données.

Pour la première version, les données seront stockées en mémoire.

Fonctions prévues :

* save()
* findById()
* findAll()

---

### Services

Les services contiennent la logique métier.

#### UserService

Responsabilités :

* créer un utilisateur ;
* récupérer un utilisateur.

#### EmailService

Responsabilités :

* envoyer un email ;
* simuler un service SMTP.

---

### Handlers

Exemple :

Workflow
    ↓
register
    ↓
RegisterHandler
    ↓
UserService
```

Handlers prévus :

#### RegisterHandler

Responsabilités :

* créer un nouvel utilisateur ;
* sauvegarder l'utilisateur.

#### SendEmailHandler

Responsabilités :

* envoyer l'email de bienvenue.

---

###  Main

Le fichier main.ts est le point d'entrée du programme.

Responsabilités :

* charger le JSON ;
* construire le moteur ;
* démarrer l'exécution.

---

## Flux d'exécution

```text
EX1.json
    ↓
WorkflowEngine
    ↓
Start
    ↓
RegisterHandler
    ↓
UserService
    ↓
UserRepository
    ↓
SendEmailHandler
    ↓
EmailService
    ↓
End




---

