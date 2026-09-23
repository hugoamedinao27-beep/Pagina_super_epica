# Sistema de control de asistencia

Sistema web para registrar la entrada y salida de los trabajadores de Tienda Super Wai.

El administrador puede crear, modificar y desactivar usuarios, además de consultar reportes de atrasos, salidas anticipadas e inasistencias. Los empleados pueden iniciar sesión y registrar su asistencia diaria.

## Requisitos

- Node.js 20.12 o superior.
- MySQL 8.

## Instalación

1. Instalar las dependencias:

```powershell
npm install
```

2. Copiar `.env.example` como `.env` y completar los datos de MySQL y del administrador. El archivo `.env` contiene información privada y no debe subirse a GitHub.

3. Crear y verificar la base de datos:

```powershell
npm run init-db
```

4. Iniciar el sistema:

```powershell
npm start
```

Luego se debe abrir `http://localhost:3000`. El correo y la contraseña del administrador son los valores configurados en `ADMIN_EMAIL` y `ADMIN_PASSWORD`.

## Pruebas

Para ejecutar todas las pruebas:

```powershell
npm test
```

También se pueden ejecutar por separado:

```powershell
npm run test:unit
npm run test:integration
npm run test:concurrency
npm run test:coverage
```

Las pruebas de integración y concurrencia utilizan bases de datos temporales, por lo que no modifican los datos reales del sistema.

## Estructura principal

- `routes`: rutas de la aplicación.
- `models`: acceso a datos y reglas de negocio.
- `middleware`: autenticación y manejo de errores.
- `src`: interfaz web.
- `test`: pruebas automatizadas.
