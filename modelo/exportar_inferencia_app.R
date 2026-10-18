# Exportación reproducible R -> navegador y referencias numéricas de las pruebas.
# Uso: Rscript modelo/exportar_inferencia_app.R CARPETA_SALIDA_NUEVA
args <- commandArgs(FALSE)
self <- sub("^--file=", "", grep("^--file=", args, value = TRUE)[1])
pkg <- dirname(normalizePath(self, mustWork = TRUE))
a <- commandArgs(TRUE)
if (length(a) != 1L || file.exists(a[1])) stop("Indica una carpeta de salida nueva.")
stopifnot(requireNamespace("jsonlite", quietly = TRUE))
source(file.path(pkg, "etapas/04_contraste_k_y_distancias.R"), encoding = "UTF-8")
source(file.path(pkg, "etapas/07_predecir_y_exportar.R"), encoding = "UTF-8")
m <- readRDS(file.path(pkg, "resultados/modelo_oct_g5.rds"))
x <- readRDS(file.path(pkg, "resultados/entradas_59.rds"))
stopifnot(m$type == "OCT_G5_FINAL", m$version == "1.5.0")
named <- function(z) as.list(setNames(as.numeric(z), names(z)))
bundle <- list(model = list(type = m$type, version = m$version, recipe = m$recipe,
  known = m$known, group_map = as.list(m$group_map),
  J = list(variable = m$J$variable, beta = m$J$beta, mean = m$J$mean, sd = m$J$sd,
    group_mean_y = named(m$J$group_mean_y), group_mean_z = named(m$J$group_mean_z)),
  municipal_means = named(m$municipal_means), global_y = m$global_y,
  global_z = m$global_z, correction = m$correction), inputs = x)
cases <- list(official = x, missingK = transform(x, K = NA_real_),
  zeroRain = transform(x, P = 0), referenceRain = transform(x, P = H),
  zeroK = transform(x, K = 0))
expected <- lapply(cases, function(z) {
  f <- predecir_modelo(m, z, x)
  names(f$componentes)[names(f$componentes) == "grupo"] <- "group"
  list(inputs = z, predictions = f$predicciones, components = f$componentes)
})
dir.create(a[1], recursive = TRUE)
write <- function(z, name) jsonlite::write_json(z, file.path(a[1], name),
  auto_unbox = TRUE, dataframe = "rows", digits = 17, na = "null", null = "null")
write(bundle, "oct-g5-runtime.json")
write(expected, "referencias_R.json")
cat("PASS: parámetros, 138 referencias, 59 entradas y 295 casos R exportados.\n")
