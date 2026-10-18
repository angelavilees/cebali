# Etapa 6. MIX = media municipal + IDW20; correccion K sobre residuos OOF.
predecir_base_vecinos <- function(d, tr, consultas) {
  stopifnot(!length(intersect(tr, consultas)), all(is.finite(d$y[tr])))
  medias <- tapply(d$y[tr], d$meta$municipio[tr], mean)
  municipal <- as.numeric(medias[as.character(d$meta$municipio[consultas])])
  municipal[!is.finite(municipal)] <- mean(d$y[tr])
  idw <- vapply(consultas, function(i) {
    nn <- head(tr[order(d$distancias[i, tr], d$ids[tr])], 20)
    weighted.mean(d$y[nn], 1 / pmax(d$distancias[i, nn] * 1000, 1)^2)
  }, numeric(1))
  .5 * municipal + .5 * idw
}

crear_particiones_internas <- function(d, tr) {
  set.seed(2026101901L)
  datos <- data.frame(pos = tr, target = d$y[tr])
  folds <- rsample::vfold_cv(datos, v = 4, strata = target, breaks = 4, pool = .1)
  lapply(folds$splits, function(s) list(
    tr = rsample::analysis(s)$pos, va = rsample::assessment(s)$pos))
}

aprender_modelo <- function(d, tr = d$entrenamiento, particiones = NULL) {
  stopifnot(length(tr) >= 3, !anyDuplicated(tr),
            all(tr %in% d$entrenamiento), all(is.finite(d$y[tr])))
  j <- aprender_componente_lluvia(d, tr)
  if (is.null(particiones)) particiones <- crear_particiones_internas(d, tr)
  oof <- rep(NA_real_, length(tr))
  visitadas <- integer(length(tr))
  for (s in particiones) {
    stopifnot(!length(intersect(s$tr, s$va)), setequal(c(s$tr, s$va), tr))
    posiciones <- match(s$va, tr)
    oof[posiciones] <- predecir_base_vecinos(d, s$tr, s$va)
    visitadas[posiciones] <- visitadas[posiciones] + 1L
  }
  stopifnot(all(is.finite(oof)), all(visitadas == 1L))
  residuo <- d$y[tr] - oof
  validas <- is.finite(d$k[tr])
  mediana <- escala <- NA_real_
  beta <- 0
  n <- 0L
  if (sum(validas) >= 3) {
    mediana <- median(d$k[tr][validas])
    escala <- sd(d$k[tr][validas])
    if (is.finite(escala) && escala >= 1e-12) {
      a <- matrix((d$k[tr][validas] - mediana) / escala, ncol = 1)
      beta <- as.numeric(solve(crossprod(a) + diag(10, ncol(a)),
                                crossprod(a, residuo[validas])))
      n <- sum(validas)
    }
  }
  conocidas <- data.frame(ID_POLIGONO = d$ids[tr],
    municipio = d$meta$municipio[tr], lon = d$meta$lon[tr],
    lat = d$meta$lat[tr], y = d$y[tr])
  modelo <- list(type = "OCT_G5_FINAL", version = "1.5.0",
    recipe = "0.5J_G5_PICK+0.5MIX_CORR", known = conocidas,
    group_map = d$mapa_grupos, inherited_groups_history = TRUE,
    J = j[c("variable", "beta", "mean", "sd", "group_mean_y", "group_mean_z")],
    municipal_means = tapply(d$y[tr], d$meta$municipio[tr], mean),
    global_y = mean(d$y[tr]), global_z = j$global_z,
    correction = list(beta = beta, median = mediana, sd = escala, n = n),
    inner_seed = 2026101901L, scope = "59 consultas fijas2025")
  list(modelo = modelo, oof = data.frame(ID_POLIGONO = d$ids[tr],
    real = d$y[tr], base_oof = oof, residuo = residuo, K = d$k[tr]),
    correlaciones = j$correlations, particiones = particiones)
}
