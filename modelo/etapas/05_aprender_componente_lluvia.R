# Etapa 5. Seleccion de la representacion de lluvia y pendiente dentro de los cinco grupos territoriales fijos.
aprender_componente_lluvia <- function(d, tr) {
  x <- d$octubre
  g <- unname(d$mapa_grupos[as.character(d$meta$municipio[tr])])
  stopifnot(!anyNA(g))
  y <- d$y[tr]
  stopifnot(all(is.finite(y)), all(is.finite(x)))
  medias_y <- tapply(y, g, mean)
  yc <- y - as.numeric(medias_y[g])
  xc <- x[tr, , drop = FALSE]
  for (j in seq_len(ncol(x))) {
    medias_x <- tapply(xc[, j], g, mean)
    xc[, j] <- xc[, j] - as.numeric(medias_x[g])
  }
  correlaciones <- colSums(xc * yc) /
    sqrt(pmax(colSums(xc^2) * sum(yc^2), 1e-24))
  elegida <- which.max(abs(correlaciones))
  v <- x[, elegida]
  media <- mean(v[tr])
  escala <- sqrt(mean((v[tr] - media)^2))
  if (!is.finite(escala) || escala < 1e-12) escala <- 1
  z <- (v - media) / escala
  medias_z <- tapply(z[tr], g, mean)
  a <- z[tr] - as.numeric(medias_z[g])
  denominador <- sum(a^2)
  beta <- if (denominador > 1e-12) sum(a * yc) / denominador else 0
  list(variable = colnames(x)[elegida], beta = beta, mean = media, sd = escala,
       group_mean_y = medias_y, group_mean_z = medias_z,
       correlations = correlaciones, global_z = mean(z[tr]))
}
