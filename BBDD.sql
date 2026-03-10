CREATE TABLE IF NOT EXISTS "Servicios" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  "nombre" TEXT CHECK(length("nombre") <= 256) NOT NULL,

  "Producto" TEXT CHECK("Producto" IN ('Dominio','Cert_SSL','Pack_alojamiento','Otros')) NOT NULL,

  "FechaCaducidad" TIMESTAMP NOT NULL,
  "Precio" REAL NOT NULL,

  "Renovacion" INTEGER CHECK("Renovacion" IN (0,1)) NOT NULL,

  "Estado" TEXT CHECK("Estado" IN ('Activo','Avisado','Renovado','Baja_Traslado','Baja_Caducidad')) NOT NULL,

  "Notas" TEXT CHECK(length("Notas") <= 256) NOT NULL,

  "Registro" TEXT CHECK("Registro" IN ('N/A_CertPacks','Correo_Dominio')) NOT NULL,

  "Cliente" TEXT CHECK(length("Cliente") <= 100) NOT NULL,
  "Contacto" TEXT CHECK(length("Contacto") <= 100) NOT NULL,
  "Mail" TEXT CHECK(length("Mail") <= 256) NOT NULL,

  "Proveedor" TEXT CHECK("Proveedor" IN ('Openprovider','datarush')) NOT NULL
);


CREATE TABLE IF NOT EXISTS "Login" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  "Usuario" TEXT CHECK(length("Usuario") <= 60) NOT NULL,
  "Correo" TEXT CHECK(length("Correo") <= 256) NOT NULL,
  "Password" TEXT CHECK(length("Password") <= 100) NOT NULL,
  "Ip" TEXT CHECK(length("Ip") <= 20) NOT NULL,

  "FerchaCreacion" TIMESTAMP NOT NULL,
  "FechaModificacon" TIMESTAMP NOT NULL
);