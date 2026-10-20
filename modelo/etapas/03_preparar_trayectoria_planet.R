# Etapa 3. Filtrar Planet, suavizar NDVI e integrar el verdor sobre la base.
preparar_trayectoria_planet <- function(d) {
  pro <- file.path(d$carpeta_datos, "Conjunto_datos_PRO_AgroCebada.csv")
  campos <- c("ID_POLIGONO", "fecha_captura", "sensor",
              "ndvi_promedio", "porcentaje_nubosidad")
  raw <- readr::read_csv(pro, col_select = tidyselect::all_of(campos),
                         show_col_types = FALSE)
  readr::stop_for_problems(raw)
  stopifnot(setequal(unique(raw$sensor), "Planet"))
  fecha <- as.Date(raw$fecha_captura, format = "%d/%m/%Y")
  stopifnot(!anyNA(fecha))
  usar <- is.finite(raw$ndvi_promedio) & is.finite(raw$porcentaje_nubosidad) &
    raw$porcentaje_nubosidad <= 20 & fecha >= as.Date("2025-04-01") &
    fecha <= as.Date("2025-10-31")
  obs <- data.frame(id = raw$ID_POLIGONO[usar],
                    dia = as.integer(format(fecha[usar], "%j")),
                    ndvi = raw$ndvi_promedio[usar])
  stopifnot(all(obs$id %in% d$ids))
  rejilla <- 91:304
  resumir <- function(id) {
    q <- obs[obs$id == id, ]
    diaria <- tapply(q$ndvi, q$dia, median)
    v <- as.numeric(diaria[as.character(rejilla)])
    movil <- vapply(seq_along(v), function(j) {
      valores <- v[max(1, j - 7):min(length(v), j + 7)]
      valores <- valores[is.finite(valores)]
      if (length(valores) >= 3) median(valores) else NA_real_
    }, numeric(1))
    curva <- if (sum(is.finite(movil)) >= 2) {
      approx(rejilla[is.finite(movil)], movil[is.finite(movil)],
             xout = rejilla, rule = 1)$y
    } else movil
    base <- if (any(is.finite(curva[rejilla <= 150]))) {
      median(curva[rejilla <= 150], na.rm = TRUE)
    } else NA_real_
    temporada <- which(rejilla >= 150 & is.finite(curva))
    integral <- pico <- inicio <- fin <- NA_real_
    if (length(temporada) && is.finite(base)) {
      pk <- temporada[which.max(curva[temporada])]
      pico <- curva[pk]
      umbral <- base + .5 * (pico - base)
      subida <- which(rejilla >= 150 & seq_along(rejilla) <= pk &
                        is.finite(curva) & curva >= umbral)
      bajada <- which(seq_along(rejilla) >= pk & is.finite(curva) & curva < umbral)
      if (length(subida)) {
        a <- subida[1]
        b <- if (length(bajada)) bajada[1] else length(rejilla)
        tramo <- curva[a:b]
        if (all(is.finite(tramo))) {
          integral <- sum(pmax(tramo - base, 0))
          inicio <- rejilla[a]
          fin <- rejilla[b]
        }
      }
    }
    list(resumen = data.frame(ID_POLIGONO = id, capturas = nrow(q),
      dias_observados = length(diaria), dias_movil = sum(is.finite(movil)),
      base = base, pico = pico, inicio_dia = inicio, fin_dia = fin,
      integral = integral),
      curva = data.frame(ID_POLIGONO = id, dia = rejilla, observado = v,
                         mediana_movil = movil, interpolado = curva))
  }
  resultados <- lapply(d$ids, resumir)
  d$planet <- do.call(rbind, lapply(resultados, `[[`, "resumen"))
  d$curvas <- do.call(rbind, lapply(resultados, `[[`, "curva"))
  d$fuentes <- c(d$fuentes, pro)
  d
}
