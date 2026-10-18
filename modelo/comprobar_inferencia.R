# Comprobar el artefacto guardado sin acceder al workspace ni a los datos originales.
args <- commandArgs(FALSE)
self <- sub("^--file=", "", grep("^--file=", args, value = TRUE)[1])
pkg <- dirname(normalizePath(self, mustWork = TRUE))
source(file.path(pkg, "etapas/04_contraste_k_y_distancias.R"), encoding = "UTF-8")
source(file.path(pkg, "etapas/07_predecir_y_exportar.R"), encoding = "UTF-8")
m <- readRDS(file.path(pkg, "resultados/modelo_oct_g5.rds"))
x <- readRDS(file.path(pkg, "resultados/entradas_59.rds"))
ref <- read.csv(file.path(pkg, "resultados/predicciones_59.csv"))
stopifnot(identical(m$type, "OCT_G5_FINAL"), identical(m$version, "1.5.0"),
  identical(m$recipe, "0.5J_G5_PICK+0.5MIX_CORR"), nrow(m$known) == 138L,
  length(unique(m$group_map)) == 5L, nrow(x) == 59L)
actual <- predecir_modelo(m, x, x)$predicciones
pos <- match(ref$ID_POLIGONO, actual$ID_POLIGONO)
delta <- max(abs(actual$RENDIMIENTO_T_HA[pos] - ref$RENDIMIENTO_T_HA))
stopifnot(!anyNA(pos), delta < 1e-12)
inversa <- predecir_modelo(m, x[59:1, rev(names(x))], x)$predicciones
stopifnot(max(abs(inversa$RENDIMIENTO_T_HA[59:1] - actual$RENDIMIENTO_T_HA)) < 1e-12)
rechaza <- function(z) inherits(try(predecir_modelo(m, z, x), silent = TRUE), "try-error")
mal <- x; mal$ID_POLIGONO[2] <- mal$ID_POLIGONO[1]; stopifnot(rechaza(mal))
mal <- x; mal$H[1] <- 0; stopifnot(rechaza(mal))
mal <- x; mal$K[1] <- Inf; stopifnot(rechaza(mal))
mal <- x; mal$municipio[1] <- "otro"; stopifnot(rechaza(mal))
# Los objetos publicados tampoco deben conservar rutas personales ni recetas anteriores.
cadenas <- function(z) {
  if (is.character(z)) return(as.vector(z))
  if (is.list(z)) return(unlist(lapply(z, cadenas), use.names = FALSE))
  character()
}
for (p in list.files(pkg, pattern = "\\.rds$", recursive = TRUE, full.names = TRUE)) {
  txt <- cadenas(readRDS(p))
  stopifnot(!any(grepl("/Users/|OCT_MIX|OCT_MIX_FINAL|RF_D|cierre_conservador", txt)))
}
cat("PASS: OCT_G5 1.5.0, 138 referencias, 59 predicciones; diferencia máxima ",
    format(delta, scientific = TRUE), "; contratos y objetos limpios.\n", sep = "")
