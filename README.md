# Universidad Davinci de Guatemala
## Ingenieria en sistemas
## Catedratico: Ing. Brandon Chitay

## Protecto realizado por:
### Francisco Javier Rojas Santos
### Carnet: 202302368

### Enlace al video de youtube: https://youtu.be/BPSxvDXMOyk  

Sistema de analíticas para streaming de música basado en MongoDB, diseñado como caso de estudio académico para el curso de Bases de Datos II de la Universidad Da Vinci de Guatemala.

## Descripción

Este proyecto implementa una plataforma completa de Business Intelligence para análisis de datos de streaming musical, simulando el ecosistema de Apple Music. Incluye generación de datos sintéticos, consultas avanzadas con aggregation pipelines de MongoDB, y una API REST para consumo de datos.

### Características Principales

- **Generación de Datos Sintéticos**: Script de seeding que genera usuarios, artistas, canciones y reproducciones realistas
- **Consultas de Agregación**: 5 pipelines de MongoDB para análisis de negocio
- **API REST**: 5 endpoints para consumo de datos analíticos
- **Infraestructura Dockerizada**: MongoDB 7.0 con persistencia de datos

## Arquitectura del Proyecto

```
apple-music-analytics/
├── api/
│   └── server.js           
├── api-design/
│   └── api-spec.md         
├── dashboard-v0/
│   ├── screenshots/             
├── database/
│   ├── docker-compose.yml  
│   └── queries.js          
├── seed.js                 
├── package.json
└── README.md
```

## Modelo de Datos

El sistema utiliza 4 colecciones principales en MongoDB:

| Colección | Descripción | Campos Clave |
|-----------|-------------|--------------|
| `users` | Usuarios de la plataforma | `_id`, `username`, `email`, `country`, `birth_date`, `subscription` |
| `artists` | Catálogo de artistas | `_id`, `name`, `genre`, `followers` |
| `songs` | Canciones del catálogo | `_id`, `title`, `artist_id`, `artist_name`, `genre`, `duration_seconds` |
| `streams` | Historial de reproducciones | `_id`, `user_id`, `song_id`, `artist_id`, `date`, `device`, `seconds_played` |


### Prerrequisitos

- Node.js 18+
- Docker y Docker Compose
- npm o yarn

## Consultas de Agregación

El archivo `database/queries.js` contiene 5 consultas de Business Intelligence:

### 1. Reporte de Regalías (Royalties)
Calcula el tiempo total de reproducción por artista en el último mes, útil para calcular pagos a artistas.

### 2. Top 10 Canciones en Guatemala
Ranking de las canciones más escuchadas en Guatemala en los últimos 7 días.

### 3. Usuarios Zombies (Churn Risk)
Identifica usuarios Premium que no han reproducido música en 30 días, candidatos para campañas de retención.

### 4. Demografía de Oyentes por Género
Distribución por rangos de edad de los oyentes de un género específico (ej: Reggaeton).

### 5. Top Fans de un Artista
Los usuarios que han escuchado más canciones distintas de un artista específico.

### Ejecutar las consultas

```bash
node database/queries.js
```

## API REST

### Iniciar el servidor

```bash
node api/server.js
```

El servidor se levanta en `http://localhost:3000`

### Endpoints Disponibles

| Método | Endpoint | Descripción | Parámetros |
|--------|----------|-------------|------------|
| GET | `/api/royalties` | Reporte de regalías | `period`, `rate`, `rate_per_minute` |
| GET | `/api/charts/top-songs` | Top canciones por región | `region`*, `days`, `limit` |
| GET | `/api/users/zombies` | Usuarios inactivos | `days`, `subscription`, `country` |
| GET | `/api/demographics/genre` | Demografía por género | `genre`* |
| GET | `/api/users/top-fans` | Top fans de artista | `artist`*, `limit` |

*Parámetros requeridos

### Ejemplos de Uso


Top 10 canciones en Guatemala
curl "http://localhost:3000/api/charts/top-songs?region=GT"

Usuarios zombies Premium
curl "http://localhost:3000/api/users/zombies?days=30&subscription=Premium"

Demografía de oyentes de Reggaeton
curl "http://localhost:3000/api/demographics/genre?genre=Reggaeton"

Top 5 fans de Bad Bunny
curl "http://localhost:3000/api/users/top-fans?artist=Bad%20Bunny&limit=5"

Reporte de regalías del último mes
curl "http://localhost:3000/api/royalties?period=30&rate=0.01"


## Tecnologías Utilizadas

| Tecnología | Versión | Uso |
|------------|---------|-----|
| MongoDB | 7.0 | Base de datos NoSQL |
| Node.js | 18+ | Runtime de JavaScript |
| Express.js | 4.x | Framework web para API |
| Docker | - | Contenedorización |
| Faker.js | @faker-js/faker | Generación de datos sintéticos |

