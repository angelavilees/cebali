# Etapa 8. Las referencias solo se leen DESPUES de entrenar y predecir.
comprobar_reproduccion <- function(d, ajuste, resultado, carpeta_paquete) {
  ref <- file.path(carpeta_paquete, "referencias")
  esperado <- read.csv(file.path(ref, "predicciones_59_vigentes.csv"))
  entradas <- readRDS(file.path(ref, "entradas_59_vigentes.rds"))
  modelo <- readRDS(file.path(ref, "modelo_vigente.rds"))
  propias <- preparar_consultas(d)
  orden <- match(esperado$ID_POLIGONO, resultado$predicciones$ID_POLIGONO)
  stopifnot(!anyNA(orden), nrow(resultado$predicciones) == 59L)
  delta <- max(abs(esperado$RENDIMIENTO_T_HA -
                    resultado$predicciones$RENDIMIENTO_T_HA[orden]))
  i <- match(entradas$ID_POLIGONO, propias$ID_POLIGONO)
  stopifnot(!anyNA(i), identical(is.na(entradas$K), is.na(propias$K[i])),
    max(abs(as.matrix(entradas[, c("lon", "lat", "P", "H", "K")]) -
              as.matrix(propias[i, c("lon", "lat", "P", "H", "K")])),
        na.rm = TRUE) < 1e-12,
    isTRUE(all.equal(ajuste$modelo$J, modelo$J, tolerance = 1e-12)),
    isTRUE(all.equal(ajuste$modelo$correction, modelo$correction, tolerance = 1e-12)),
    identical(ajuste$modelo$known, modelo$known),
    identical(ajuste$modelo$municipal_means, modelo$municipal_means),
    identical(ajuste$modelo$global_y, modelo$global_y),
    delta < 1e-12)
  invertidas <- predecir_modelo(ajuste$modelo, propias[59:1, rev(names(propias))])
  stopifnot(max(abs(invertidas$predicciones$RENDIMIENTO_T_HA[59:1] -
                     resultado$predicciones$RENDIMIENTO_T_HA)) < 1e-12)
  rechaza <- function(datos) inherits(try(predecir_modelo(
    ajuste$modelo, datos), silent = TRUE), "try-error")
  mal <- propias; mal$ID_POLIGONO[2] <- mal$ID_POLIGONO[1]; stopifnot(rechaza(mal))
  mal <- propias; mal$H[1] <- 0; stopifnot(rechaza(mal))
  mal <- propias; mal$K[1] <- Inf; stopifnot(rechaza(mal))
  mal <- propias; mal$RENDIMIENTO_T_HA <- 0; stopifnot(rechaza(mal))
  mal <- propias; mal$ID_POLIGONO[1] <- modelo$known$ID_POLIGONO[1]
  stopifnot(rechaza(mal), rechaza(propias[, names(propias) != "P"]))
  mal <- propias; mal$municipio[1] <- "municipio incorrecto"
  stopifnot(inherits(try(predecir_modelo(ajuste$modelo, mal, propias),
                        silent = TRUE), "try-error"))
  mal <- propias; mal$lon[1] <- mal$lon[1] + .01
  stopifnot(inherits(try(predecir_modelo(ajuste$modelo, mal, propias),
                        silent = TRUE), "try-error"))
  list(estado = "PASS", parcelas = 59L, diferencia_maxima_prediccion = delta,
       parametros_y_entradas_reproducidos = TRUE, pruebas_rechazo = 8L,
       invariancia_orden = TRUE, K_conocidas = sum(is.finite(d$k[d$entrenamiento])),
       K_consultas = sum(is.finite(d$k[d$consultas])))
}
