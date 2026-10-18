# Etapa 9. Reejecutar SOLO esta receta en 50 folds locales y 5 espaciales fijos.
validacion_fuera_de_muestra <- function(d, carpeta_paquete, salida) {
  ruta <- file.path(carpeta_paquete, "contratos")
  externos <- read.csv(file.path(ruta, "particiones_externas.csv"),
                       colClasses = "character")
  internos <- read.csv(file.path(ruta, "particiones_internas.csv"),
                       colClasses = "character")
  ix <- function(ids) {
    posiciones <- match(ids, d$ids)
    stopifnot(!anyNA(posiciones))
    posiciones
  }
  n <- table(d$meta$municipio[d$entrenamiento])
  q <- table(d$meta$municipio[d$consultas]) / length(d$consultas)
  pesos <- as.numeric(q[as.character(d$meta$municipio)] /
                        n[as.character(d$meta$municipio)])
  pesos[!is.finite(pesos)] <- 0
  evaluaciones <- lapply(unique(externos$particion), function(nombre) {
    z <- externos[externos$particion == nombre, ]
    tr <- ix(z$ID_POLIGONO[z$rol == "entrenamiento"])
    va <- ix(z$ID_POLIGONO[z$rol == "validacion"])
    stopifnot(!length(intersect(tr, va)), setequal(c(tr, va), d$entrenamiento))
    if (z$escenario[1] == "ESPACIAL_5") stopifnot(!length(intersect(
      z$grupo[z$rol == "entrenamiento"], z$grupo[z$rol == "validacion"])))
    sub <- internos[internos$particion == nombre, ]
    folds <- lapply(unique(sub$pliegue_interno), function(f) {
      a <- sub[sub$pliegue_interno == f, ]
      list(tr = ix(a$ID_POLIGONO[a$rol == "entrenamiento"]),
           va = ix(a$ID_POLIGONO[a$rol == "validacion"]))
    })
    ajuste <- aprender_modelo(d, tr, folds)
    # Las etiquetas de validacion no pueden cambiar lo aprendido.
    alterado <- d
    alterado$y[va] <- 1e9 + seq_along(va)
    stopifnot(identical(ajuste$modelo, aprender_modelo(alterado, tr, folds)$modelo))
    pred <- predecir_modelo(ajuste$modelo, preparar_consultas(d, va))$predicciones
    data.frame(particion = nombre, escenario = z$escenario[1],
      repeticion = z$repeticion[1], pliegue = z$pliegue[1],
      ID_POLIGONO = d$ids[va], municipio = d$meta$municipio[va],
      real = d$y[va], prediccion = pred$RENDIMIENTO_T_HA, peso = pesos[va])
  })
  oof <- do.call(rbind, evaluaciones)
  referencia <- read.csv(file.path(carpeta_paquete, "referencias/oof_vigente.csv"),
                         colClasses = c(particion = "character"))
  clave <- function(t) paste(t$particion, t$ID_POLIGONO, sep = "|")
  m <- match(clave(oof), clave(referencia))
  write.csv(oof, file.path(salida, "validacion_oof.csv"), row.names = FALSE)
  # La matriz de entrenamiento y la inferencia puntual usan haversine con
  # distinto orden de operaciones. Se admite solo redondeo numerico, 1e-10 t/ha.
  delta_oof <- max(abs(oof$prediccion - referencia$prediccion[m]))
  stopifnot(!anyNA(m), nrow(oof) == nrow(referencia),
            max(abs(oof$real - referencia$real[m])) == 0,
            max(abs(oof$peso - referencia$peso[m])) < 1e-12,
            delta_oof < 1e-10)
  jsonlite::write_json(list(estado = "PASS", folds_externos = 55L,
    filas_oof = nrow(oof), diferencia_maxima_oof = delta_oof,
    tolerancia_numerica_t_ha = 1e-10, pruebas_aislamiento_etiquetas = 55L),
    file.path(salida, "verificacion_oof.json"), auto_unbox = TRUE,
    pretty = TRUE, digits = 16)
  resumen <- do.call(rbind, lapply(split(oof, oof$escenario), function(z) {
    error <- z$prediccion - z$real
    repeticiones <- split(seq_len(nrow(z)), z$repeticion)
    rmse_repeticion <- vapply(repeticiones, function(i)
      sqrt(sum(z$peso[i] * error[i]^2) / sum(z$peso[i])), numeric(1))
    data.frame(escenario = z$escenario[1], parcelas_unicas = length(unique(z$ID_POLIGONO)),
      filas_oof = nrow(z), RMSE_media_repeticiones = mean(rmse_repeticion),
      RMSE_pooled = sqrt(sum(z$peso * error^2) / sum(z$peso)),
      MAE = sum(z$peso * abs(error)) / sum(z$peso))
  }))
  write.csv(oof, file.path(salida, "validacion_oof.csv"), row.names = FALSE)
  write.csv(resumen, file.path(salida, "validacion_metricas.csv"), row.names = FALSE)
  resumen
}

# Incertidumbre: proper aprende; calibracion fija el radio; validacion lo evalua.
calibrar_intervalos <- function(d, carpeta_paquete, salida) {
  ruta <- file.path(carpeta_paquete, "contratos")
  roles <- read.csv(file.path(ruta, "calibracion_roles.csv"), colClasses = "character")
  internos <- read.csv(file.path(ruta, "calibracion_interna.csv"), colClasses = "character")
  ix <- function(ids) {
    pos <- match(ids, d$ids)
    stopifnot(!anyNA(pos))
    pos
  }
  n <- table(d$meta$municipio[d$entrenamiento])
  q <- table(d$meta$municipio[d$consultas]) / length(d$consultas)
  peso <- as.numeric(q[as.character(d$meta$municipio)] / n[as.character(d$meta$municipio)])
  peso[!is.finite(peso)] <- 0
  filas <- lapply(unique(roles$particion), function(nombre) {
    z <- roles[roles$particion == nombre, ]
    proper <- ix(z$ID_POLIGONO[z$rol == "proper"])
    cal <- ix(z$ID_POLIGONO[z$rol == "calibracion"])
    va <- ix(z$ID_POLIGONO[z$rol == "validacion"])
    stopifnot(!length(intersect(proper, cal)), !length(intersect(proper, va)),
      !length(intersect(cal, va)), setequal(c(proper, cal, va), d$entrenamiento))
    sub <- internos[internos$particion == nombre, ]
    folds <- lapply(unique(sub$pliegue_interno), function(f) {
      a <- sub[sub$pliegue_interno == f, ]
      list(tr = ix(a$ID_POLIGONO[a$rol == "entrenamiento"]),
           va = ix(a$ID_POLIGONO[a$rol == "validacion"]))
    })
    ajuste <- aprender_modelo(d, proper, folds)
    alterado <- d
    alterado$y[c(cal, va)] <- 1e9
    stopifnot(identical(ajuste$modelo, aprender_modelo(alterado, proper, folds)$modelo))
    pred <- predecir_modelo(ajuste$modelo, preparar_consultas(d, c(cal, va)))$
      predicciones$RENDIMIENTO_T_HA
    pc <- pred[seq_along(cal)]
    pv <- pred[length(cal) + seq_along(va)]
    errores_cal <- abs(d$y[cal] - pc)
    rango <- ceiling((length(cal) + 1) * .8)
    stopifnot(rango <= length(cal))
    radio <- sort(errores_cal)[rango]
    data.frame(particion = nombre, escenario = z$escenario[1],
      ID_POLIGONO = d$ids[va], real = d$y[va], centro = pv,
      inferior = pv - radio, superior = pv + radio,
      cubierto = abs(pv - d$y[va]) <= radio, ancho = 2 * radio, peso = peso[va])
  })
  intervalos <- do.call(rbind, filas)
  ref <- read.csv(file.path(carpeta_paquete, "referencias/intervalos_vigentes.csv"),
                  colClasses = c(particion = "character"))
  clave <- function(t) paste(t$particion, t$ID_POLIGONO, sep = "|")
  i <- match(clave(intervalos), clave(ref))
  delta <- max(abs(as.matrix(intervalos[, c("centro", "inferior", "superior")]) -
                     as.matrix(ref[i, c("centro", "inferior", "superior")])))
  stopifnot(!anyNA(i), nrow(intervalos) == 414L, delta < 1e-10,
            identical(intervalos$cubierto, ref$cubierto[i]))
  resumen <- do.call(rbind, lapply(split(intervalos, intervalos$escenario), function(z)
    data.frame(escenario = z$escenario[1], filas = nrow(z),
      cobertura_ponderada = sum(z$peso * z$cubierto) / sum(z$peso),
      ancho_medio_ponderado = sum(z$peso * z$ancho) / sum(z$peso))))
  write.csv(intervalos, file.path(salida, "intervalos_validacion.csv"), row.names = FALSE)
  write.csv(resumen, file.path(salida, "cobertura_validacion.csv"), row.names = FALSE)
  jsonlite::write_json(list(estado = "PASS", particiones = 15L, intervalos = 414L,
    diferencia_maxima = delta, nominal = .8, pruebas_aislamiento = 15L,
    intervalos_para_full138_certificados = FALSE),
    file.path(salida, "verificacion_calibracion.json"), auto_unbox = TRUE,
    pretty = TRUE, digits = 16)
  resumen
}
